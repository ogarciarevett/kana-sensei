import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { isDue } from '../lib/srs';
import type { Grade, KanaInfo } from '../lib/types';
import { HIRAGANA } from '../data/hiragana';
import { KATAKANA } from '../data/katakana';
import { KANJI_N5 } from '../data/kanjiN5';
import { KanaCard } from '../components/KanaCard';
import { GradeButtons } from '../components/GradeButtons';
import { MnemonicPanel } from '../components/MnemonicPanel';
import { StrokeCanvas } from '../components/StrokeCanvas';
import { StrokeReview } from '../components/StrokeReview';
import { gradeDrawing, loadReference, type DrawingVerdict, type Reference, type Stroke } from '../lib/strokes';

type Mode = 'recognition' | 'recall' | 'writing' | 'mixed';
type ActiveMode = Exclude<Mode, 'mixed'>;

const ALL_INFO: Record<string, KanaInfo> = (() => {
  const m: Record<string, KanaInfo> = {};
  for (const k of [...HIRAGANA, ...KATAKANA, ...KANJI_N5 as KanaInfo[]]) m[k.char] = k;
  return m;
})();

const MODE_LABEL: Record<Mode, string> = {
  recognition: 'Reconocer',
  recall: 'Recordar',
  writing: 'Escribir',
  mixed: 'Mixto'
};

function pickChoices(correct: KanaInfo, pool: KanaInfo[]): KanaInfo[] {
  const sameRow = pool.filter(k => k.row === correct.row && k.char !== correct.char);
  const others = pool.filter(k => k.row !== correct.row && k.char !== correct.char);
  const distractors: KanaInfo[] = [];
  const shuffle = <T,>(a: T[]) => a.slice().sort(() => Math.random() - 0.5);
  distractors.push(...shuffle(sameRow).slice(0, 3));
  while (distractors.length < 3 && others.length) {
    distractors.push(shuffle(others).shift()!);
  }
  return shuffle([correct, ...distractors.slice(0, 3)]);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickActive(mode: Mode): ActiveMode {
  if (mode !== 'mixed') return mode;
  const options: ActiveMode[] = ['recognition', 'recall', 'writing'];
  return options[Math.floor(Math.random() * options.length)];
}

export function Practice() {
  const hydrated = useStore(s => s.hydrated);
  const hydrate = useStore(s => s.hydrate);
  const progress = useStore(s => s.progress);
  const mode = useStore(s => s.settings.mode) as Mode;
  const setMode = useStore(s => s.setMode);
  const gradeChar = useStore(s => s.gradeChar);
  const logSession = useStore(s => s.logSession);

  const [queue, setQueue] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [input, setInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeMode, setActiveMode] = useState<ActiveMode>('recognition');
  const [choices, setChoices] = useState<KanaInfo[]>([]);
  const [choiceAnswer, setChoiceAnswer] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Writing-mode state
  const [userStrokes, setUserStrokes] = useState<Stroke[]>([]);
  const [reference, setReference] = useState<Reference | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<DrawingVerdict | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const due = Object.values(progress).filter(e => isDue(e)).map(e => e.char);
    due.sort(() => Math.random() - 0.5);
    setQueue(due);
    setIdx(0);
    setRevealed(false);
    setInput('');
    setCorrectCount(0);
    setTotalCount(0);
    setDone(false);
  }, [hydrated]); // only on initial hydration

  const currentChar = queue[idx];
  const info = currentChar ? ALL_INFO[currentChar] : null;
  const expected = info?.reading ?? '';
  const meaning = useMemo(() => {
    if (!info) return '';
    const m = (info as KanaInfo & { meaning?: string }).meaning;
    return m ?? info.example_word.meaning;
  }, [info]);

  useEffect(() => {
    if (!info) return;
    const m = pickActive(mode);
    setActiveMode(m);
    setInput('');
    setRevealed(false);
    setChoiceAnswer(null);
    setUserStrokes([]);
    setVerdict(null);
    setRefError(null);
    setReference(null);

    if (m === 'recall') {
      const pool =
        info.script === 'hiragana' ? HIRAGANA :
        info.script === 'katakana' ? KATAKANA :
        (KANJI_N5 as KanaInfo[]);
      setChoices(pickChoices(info, pool));
    } else if (m === 'writing') {
      setChoices([]);
      let cancelled = false;
      loadReference(info.char)
        .then(ref => { if (!cancelled) setReference(ref); })
        .catch(e => { if (!cancelled) setRefError(e.message); });
      return () => { cancelled = true; };
    } else {
      setChoices([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [currentChar, mode, info]);

  function handleGrade(g: Grade) {
    if (!currentChar) return;
    gradeChar(currentChar, g);
    setTotalCount(c => c + 1);
    if (g !== 'again') setCorrectCount(c => c + 1);
    const next = idx + 1;
    if (next >= queue.length) {
      const accuracy = totalCount + 1 > 0 ? (correctCount + (g !== 'again' ? 1 : 0)) / (totalCount + 1) : 0;
      logSession({ date: todayISO(), chars_reviewed: totalCount + 1, accuracy });
      setDone(true);
    } else {
      setIdx(next);
    }
  }

  function submitRecognition() {
    if (!revealed) setRevealed(true);
  }

  function pickChoice(char: string) {
    if (choiceAnswer) return;
    setChoiceAnswer(char);
    setRevealed(true);
  }

  function submitWriting() {
    if (!reference) return;
    setVerdict(gradeDrawing(userStrokes, reference));
    setRevealed(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || !info) return;
      if (e.key === ' ') {
        // Space reveals in recognition/recall only — in writing mode it'd
        // interfere with drawing.
        if (activeMode !== 'writing') {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (revealed) {
        if (e.key >= '1' && e.key <= '4') {
          const map: Record<string, Grade> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
          handleGrade(map[e.key]);
        }
      } else if (activeMode === 'recognition' && e.key === 'Enter') {
        submitRecognition();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!hydrated) return <div className="p-8 text-neutral-500">Cargando…</div>;

  if (queue.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold">¡Sin repasos pendientes!</h1>
        <p className="text-neutral-500">Vuelve más tarde o aprende nuevos caracteres.</p>
        <div className="flex justify-center gap-3">
          <Link to="/learn/new" className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm">Aprender nuevos</Link>
          <Link to="/" className="rounded-md border border-neutral-300 px-4 py-2 text-sm">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  if (done) {
    const acc = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    return (
      <div className="mx-auto max-w-xl p-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold">¡Sesión completa!</h1>
        <p className="text-neutral-600">Revisaste <strong>{totalCount}</strong> caracteres con <strong>{acc}%</strong> de precisión.</p>
        <Link to="/" className="inline-block rounded-md bg-neutral-900 text-white px-5 py-2 text-sm">Volver al inicio</Link>
      </div>
    );
  }

  if (!info) return null;

  const modePills: Mode[] = ['recognition', 'recall', 'writing', 'mixed'];

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500">
          {idx + 1} / {queue.length} · {MODE_LABEL[activeMode]}
        </span>
        <div className="flex rounded-md border border-neutral-300 overflow-hidden">
          {modePills.map(p => (
            <button
              key={p}
              onClick={() => setMode(p)}
              className={`px-3 py-1.5 ${mode === p ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}
            >
              {MODE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {activeMode === 'recognition' && (
        <div className="text-center space-y-4">
          <KanaCard char={info.char} />
          {!revealed ? (
            <div className="space-y-3">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitRecognition(); }}
                placeholder="romaji…"
                className="w-full rounded-md border border-neutral-300 px-4 py-3 text-center text-lg focus:outline-none focus:border-neutral-900"
              />
              <button
                onClick={submitRecognition}
                className="w-full rounded-md bg-neutral-900 text-white px-4 py-3 text-sm"
              >
                Revelar respuesta (Enter)
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-left">
              <div className="text-center">
                <span className="text-xs text-neutral-500">Tu respuesta</span>
                <div className={`text-lg ${input.trim().toLowerCase() === expected.toLowerCase() ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {input || <em className="text-neutral-400">(vacío)</em>}
                </div>
                <div className="mt-1 text-sm text-neutral-500">Correcto: <strong className="text-neutral-900">{expected}</strong></div>
              </div>
              <MnemonicPanel info={info} />
              <GradeButtons onGrade={handleGrade} />
            </div>
          )}
        </div>
      )}

      {activeMode === 'recall' && (
        <div className="space-y-4 text-center">
          <div className="text-2xl font-semibold">{expected}</div>
          <p className="text-sm text-neutral-500">Elige el carácter correcto</p>
          <div className="grid grid-cols-2 gap-3">
            {choices.map(c => {
              const isCorrect = c.char === info.char;
              const isChosen = choiceAnswer === c.char;
              const showResult = revealed && (isChosen || isCorrect);
              const cls = showResult
                ? isCorrect ? 'border-emerald-500 bg-emerald-50' : 'border-rose-500 bg-rose-50'
                : 'border-neutral-300 hover:bg-neutral-50';
              return (
                <button
                  key={c.char}
                  disabled={!!choiceAnswer}
                  onClick={() => pickChoice(c.char)}
                  className={`font-ja text-5xl border-2 rounded-lg py-6 ${cls}`}
                >
                  {c.char}
                </button>
              );
            })}
          </div>
          {revealed && (
            <div className="space-y-3 text-left">
              <MnemonicPanel info={info} />
              <GradeButtons onGrade={handleGrade} />
            </div>
          )}
        </div>
      )}

      {activeMode === 'writing' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-sm text-neutral-500">Escribe el carácter</div>
            <div className="text-lg font-semibold">
              <span className="text-neutral-900">{expected}</span>
              {meaning && <span className="text-neutral-500"> · {meaning}</span>}
            </div>
          </div>

          {refError && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Sin datos de trazos para este carácter. Escribe y califícate manualmente.
              <div className="mt-2 text-center">
                <KanaCard char={info.char} size="sm" />
              </div>
            </div>
          )}

          {!revealed ? (
            <div className="space-y-3">
              <StrokeCanvas
                strokes={userStrokes}
                onStrokesChange={setUserStrokes}
                reference={reference ?? undefined}
                showReference={false}
              />
              <div className="flex gap-2">
                <button
                  onClick={submitWriting}
                  disabled={!reference || userStrokes.length === 0}
                  className="flex-1 rounded-md bg-neutral-900 text-white px-4 py-3 text-sm disabled:opacity-40"
                >
                  Listo · evaluar
                </button>
                {refError && (
                  <button
                    onClick={() => setRevealed(true)}
                    className="flex-1 rounded-md border border-neutral-300 px-4 py-3 text-sm"
                  >
                    Calificar manualmente
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {reference && verdict ? (
                <StrokeReview userStrokes={userStrokes} reference={reference} verdict={verdict} />
              ) : (
                <div className="text-center">
                  <KanaCard char={info.char} />
                  <div className="text-sm text-neutral-500 mt-1">{expected}</div>
                </div>
              )}
              <MnemonicPanel info={info} />
              <GradeButtons onGrade={handleGrade} highlight={verdict?.suggested} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
