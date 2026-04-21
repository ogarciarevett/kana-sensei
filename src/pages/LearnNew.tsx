import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { HIRAGANA } from '../data/hiragana';
import { KATAKANA } from '../data/katakana';
import { KANJI_N5 } from '../data/kanjiN5';
import type { KanaInfo } from '../lib/types';
import { KanaCard } from '../components/KanaCard';
import { MnemonicPanel } from '../components/MnemonicPanel';

export function LearnNew() {
  const hydrated = useStore(s => s.hydrated);
  const hydrate = useStore(s => s.hydrate);
  const progress = useStore(s => s.progress);
  const introduceChar = useStore(s => s.introduceChar);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const candidates = useMemo((): KanaInfo[] => {
    const out: KanaInfo[] = [];
    const push = (list: KanaInfo[]) => {
      for (const k of list) {
        if (!progress[k.char]) out.push(k);
        if (out.length >= 5) return true;
      }
      return false;
    };
    if (push(HIRAGANA)) return out;
    if (push(KATAKANA)) return out;
    push(KANJI_N5 as KanaInfo[]);
    return out;
  }, [progress]);

  if (!hydrated) return <div className="p-8 text-neutral-500">Cargando…</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Aprender nuevos</h1>
        <p className="text-sm text-neutral-500">Hasta 5 caracteres pendientes. Márcalos como introducidos para incluirlos en tu cola de repaso.</p>
      </header>

      {candidates.length === 0 ? (
        <p className="text-neutral-500">Ya has introducido todos los caracteres disponibles.</p>
      ) : (
        <ul className="space-y-4">
          {candidates.map(k => {
            const added = !!progress[k.char];
            const meaning =
              (k as KanaInfo & { meaning?: string }).meaning ?? k.example_word.meaning;
            return (
              <li key={k.char} className="rounded-lg border border-neutral-200 bg-white p-4 flex gap-4 items-start">
                <div className="flex-shrink-0">
                  <KanaCard char={k.char} />
                  <div className="text-center text-xs text-neutral-500 mt-1">{k.reading}</div>
                </div>
                <div className="flex-1 space-y-3">
                  <MnemonicPanel info={k} />
                  <button
                    disabled={added}
                    onClick={() => introduceChar(k.char, k.reading, k.script, meaning)}
                    className={`w-full rounded-md px-4 py-2 text-sm ${added ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}
                  >
                    {added ? '✓ Introducido' : 'Marcar como introducido'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-4">
        <Link to="/practice" className="inline-block rounded-md bg-neutral-900 text-white px-5 py-2 text-sm">
          Empezar repaso ahora
        </Link>
      </div>
    </div>
  );
}
