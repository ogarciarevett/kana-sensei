import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { saveQuest } from '../lib/memoryClient';
import { parseQuest, type QuestSection } from '../lib/parseQuest';
import { askClaude } from '../lib/askClaude';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function QuestImport() {
  const hydrated = useStore(s => s.hydrated);
  const hydrate = useStore(s => s.hydrate);
  const preferredModel = useStore(s => s.settings.preferred_model);

  const [date, setDate] = useState(todayISO());
  const [text, setText] = useState('');
  const [sections, setSections] = useState<QuestSection[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState('');
  const [correction, setCorrection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await saveQuest(date, text);
      setSections(parseQuest(text));
      setSaved(true);
    } catch (e: any) {
      setError(e.message || 'error al guardar');
    }
  }

  const closingQuestion = sections.find(s => s.heading.includes('❓'));

  async function askCorrection() {
    if (!closingQuestion) return;
    setLoading(true);
    setCorrection(null);
    try {
      const prompt = `Pregunta del quest:\n${closingQuestion.body}\n\nMi respuesta:\n${answer}\n\nPor favor corrige mi japonés, explica errores y sugiere mejoras.`;
      const res = await askClaude(prompt, preferredModel);
      setCorrection(res);
    } catch (e: any) {
      setCorrection(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) return <div className="p-8 text-neutral-500">Cargando…</div>;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Pegar quest del día</h1>
        <p className="text-sm text-neutral-500">Pega aquí el markdown del quest diario que te generó Claude.</p>
      </header>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-neutral-500">Fecha</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Pega el quest del día de Claude aquí…"
        className="w-full h-64 rounded-md border border-neutral-300 p-3 text-sm font-mono"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!text.trim()}
          className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-40"
        >
          Guardar y parsear
        </button>
        {saved && <span className="text-sm text-emerald-600">Guardado en memory/quests/{date}.md</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>

      {sections.length > 0 && (
        <section className="space-y-3 pt-4">
          <h2 className="text-sm font-medium text-neutral-700">Secciones parseadas</h2>
          {sections.map((s, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 bg-white p-4">
              <h3 className="font-medium">{s.heading}</h3>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{s.body}</pre>
            </div>
          ))}
        </section>
      )}

      {closingQuestion && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <h2 className="text-sm font-medium">Responder la pregunta final</h2>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Escribe tu respuesta en japonés o romaji…"
            className="w-full h-32 rounded-md border border-neutral-300 p-3 text-sm"
          />
          <button
            onClick={askCorrection}
            disabled={!answer.trim() || loading}
            className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-40"
          >
            {loading ? 'Preguntando…' : 'Pedir corrección a Claude'}
          </button>
          {correction && (
            <div className="rounded-md bg-white border border-neutral-200 p-3 text-sm whitespace-pre-wrap">
              {correction}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
