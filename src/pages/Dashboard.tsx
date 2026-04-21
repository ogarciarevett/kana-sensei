import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStore } from '../store/useStore';
import { isDue } from '../lib/srs';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function Dashboard() {
  const hydrated = useStore(s => s.hydrated);
  const hydrate = useStore(s => s.hydrate);
  const user = useStore(s => s.user);
  const progress = useStore(s => s.progress);
  const session_log = useStore(s => s.session_log);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const counts = useMemo(() => {
    let hira = 0, kata = 0, kanji = 0, due = 0;
    for (const entry of Object.values(progress)) {
      if (entry.script === 'hiragana') hira++;
      if (entry.script === 'katakana') kata++;
      if (entry.script === 'kanji') kanji++;
      if (isDue(entry)) due++;
    }
    return { hira, kata, kanji, due };
  }, [progress]);

  const chartData = useMemo(() => {
    return session_log.slice(-14).map(s => ({
      date: s.date.slice(5),
      accuracy: Math.round(s.accuracy * 100)
    }));
  }, [session_log]);

  if (!hydrated) return <div className="p-8 text-neutral-500">Cargando…</div>;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
        <p className="text-sm text-neutral-500">Practica hoy para mantener tu racha.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Racha" value={`${user.streak} 🔥`} />
        <Metric label="Hiragana" value={`${counts.hira} / 46`} />
        <Metric label="Katakana" value={`${counts.kata} / 46`} />
        <Metric label="Kanji N5" value={`${counts.kanji} / 103`} />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-neutral-500">Pendientes ahora</div>
            <div className="text-xl font-semibold">{counts.due} caracteres</div>
          </div>
          <Link
            to="/practice"
            className="rounded-md bg-neutral-900 text-white px-5 py-3 text-sm font-medium hover:bg-neutral-800"
          >
            Empezar a practicar
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to="/learn/new" className="rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50">
          <div className="font-medium">Aprender nuevos</div>
          <div className="text-xs text-neutral-500">Descubre hasta 5 caracteres nuevos.</div>
        </Link>
        <Link to="/quest/import" className="rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50">
          <div className="font-medium">Pegar quest del día</div>
          <div className="text-xs text-neutral-500">Guarda y parsea tu quest de Claude.</div>
        </Link>
        <Link to="/ask-claude" className="rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50">
          <div className="font-medium">Preguntar a Claude</div>
          <div className="text-xs text-neutral-500">Corrige tu japonés al vuelo.</div>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-medium text-neutral-700 mb-3">Precisión últimos 14 días</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-neutral-500">Aún sin datos, completa tu primera sesión.</p>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={12} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
