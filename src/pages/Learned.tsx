import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { ProgressEntry, Script } from '../lib/types';
import { isDue } from '../lib/srs';

const SCRIPT_LABEL: Record<Script, string> = {
  hiragana: 'Hiragana',
  katakana: 'Katakana',
  kanji: 'Kanji N5'
};

const GRADE_COLOR: Record<NonNullable<ProgressEntry['last_grade']>, string> = {
  again: 'text-rose-600',
  hard: 'text-amber-600',
  good: 'text-neutral-700',
  easy: 'text-emerald-600'
};

function relativeDue(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'ahora';
  const h = Math.round(ms / 3600_000);
  if (h < 24) return `en ${h} h`;
  const d = Math.round(h / 24);
  return `en ${d} d`;
}

export function Learned() {
  const hydrated = useStore(s => s.hydrated);
  const hydrate = useStore(s => s.hydrate);
  const progress = useStore(s => s.progress);
  const rescheduleNow = useStore(s => s.rescheduleNow);
  const navigate = useNavigate();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const groups = useMemo(() => {
    const g: Record<Script, ProgressEntry[]> = { hiragana: [], katakana: [], kanji: [] };
    for (const entry of Object.values(progress)) {
      g[entry.script].push(entry);
    }
    // Sort each group: overdue first, then by soonest due.
    for (const s of Object.keys(g) as Script[]) {
      g[s].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
    }
    return g;
  }, [progress]);

  function toggle(char: string) {
    const next = new Set(selected);
    if (next.has(char)) next.delete(char);
    else next.add(char);
    setSelected(next);
  }

  function practiceOne(char: string) {
    rescheduleNow([char]);
    navigate('/practice');
  }

  function practiceSelected() {
    if (selected.size === 0) return;
    rescheduleNow(Array.from(selected));
    setSelected(new Set());
    navigate('/practice');
  }

  if (!hydrated) return <div className="p-8 text-neutral-500">Cargando…</div>;

  const total = Object.values(progress).length;
  if (total === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold">Aún no hay caracteres practicados</h1>
        <p className="text-neutral-500">Introduce algunos desde "Aprender nuevos" y vuelven a aparecer aquí.</p>
        <Link to="/learn/new" className="inline-block rounded-md bg-neutral-900 text-white px-4 py-2 text-sm">
          Aprender nuevos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Practicados</h1>
          <p className="text-sm text-neutral-500">{total} caracteres en tu cola. Toca uno para repasarlo ya.</p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={practiceSelected}
            className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm"
          >
            Practicar seleccionados ({selected.size})
          </button>
        )}
      </header>

      {(Object.keys(groups) as Script[]).map(script => {
        const items = groups[script];
        if (items.length === 0) return null;
        const max = script === 'kanji' ? 103 : 46;
        return (
          <section key={script} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-neutral-700">{SCRIPT_LABEL[script]}</h2>
              <span className="text-xs text-neutral-500">{items.length} / {max}</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map(entry => {
                const isSelected = selected.has(entry.char);
                const due = isDue(entry);
                const acc = entry.seen > 0 ? Math.round((entry.correct / entry.seen) * 100) : 0;
                return (
                  <li
                    key={entry.char}
                    className={`rounded-lg border p-3 flex items-center gap-3 ${
                      isSelected ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <button
                      onClick={() => toggle(entry.char)}
                      className="font-ja text-4xl text-neutral-900 select-none px-2"
                      aria-label={`seleccionar ${entry.char}`}
                    >
                      {entry.char}
                    </button>
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-neutral-900">{entry.reading}</span>
                        {entry.meaning && (
                          <span className="text-neutral-500 truncate">· {entry.meaning}</span>
                        )}
                      </div>
                      <div className="text-neutral-500 mt-0.5 flex flex-wrap gap-x-3">
                        <span>{entry.seen} rep · {acc}%</span>
                        <span className={due ? 'text-rose-600' : 'text-neutral-500'}>
                          {due ? 'vence ahora' : `vence ${relativeDue(entry.due_at)}`}
                        </span>
                        {entry.last_grade && (
                          <span className={GRADE_COLOR[entry.last_grade]}>
                            última: {entry.last_grade}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => practiceOne(entry.char)}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50"
                    >
                      Repasar
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
