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

type Mode = 'recognition' | 'recall' | 'mixed';

const ALL_INFO: Record<string, KanaInfo> = (() => {
  const m: Record<string, KanaInfo> = {};
  for (const k of [...HIRAGANA, ...KATAKANA, ...KANJI_N5 as KanaInfo[]]) m[k.char] = k;
  return m;
})();

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

export function Practice() {
  const hydrated = useStore(s => s.hydrated);
  const hydrate = useStore(s => s.hydrate);
  const progress = useStore(s => s.progress);
  const mode = useStore(s => s.settings.mode) as Mode;
  const gradeChar = useStore(s => s.gradeChar);
  const logSession = useStore(s => s.logSession);

  const [queue, setQueue] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [input, setInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeMode, setActiveMode] = useState<'recognition' | 'recall'>('recognition');
  const [choices, setChoices] = useState<KanaInfo[]>([]);
  const [choiceAnswer, setChoiceAnswer] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!info) return;
    const m: 'recognition' | 'recall' =
      mode === 'mixed' ? (Math.random() < 0.5 ? 'recognition' : 'recall') : mode;
    setActiveMode(m);
    setInput('');
    setRevealed(false);
    setChoiceAnswer(null);
    if (m === 'recall') {
      const pool =
        info.script === 'hiragana' ? HIRAGANA :
        info.script === 'katakana' ? KATAKANA :
        (KANJI_N5 as KanaInfo[]);
      setChoices(pickChoices(info, pool));
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
    if (!revealed) {
      setRevealed(true);
    }
  }

  function pickChoice(char: string) {
    if (choiceAnswer) return;
    setChoiceAnswer(char);
    setRevealed(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || !info) return;
      if (e.key === ' ') {
        e.preventDefault();
        setRevealed(true);
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

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <div className="text-xs text-neutral-500">
        {idx + 1} / {queue.length} · Modo: {activeMode === 'recognition' ? 'Reconocer' : 'Recordar'}
      </div>

      {activeMode === 'recognition' ? (
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
      ) : (
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
    </div>
  );
}
