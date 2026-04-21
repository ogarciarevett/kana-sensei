import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { askClaude } from '../lib/askClaude';

export function AskClaude() {
  const hydrated = useStore(s => s.hydrated);
  const hydrate = useStore(s => s.hydrate);
  const chatHistory = useStore(s => s.chat_history);
  const appendChat = useStore(s => s.appendChat);
  const preferredModel = useStore(s => s.settings.preferred_model);
  const setModel = useStore(s => s.setModel);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  async function send() {
    if (!prompt.trim() || loading) return;
    const userMsg = prompt.trim();
    setPrompt('');
    setError(null);
    setLoading(true);
    appendChat({ role: 'user', content: userMsg, model: preferredModel, timestamp: new Date().toISOString() });
    try {
      const res = await askClaude(userMsg, preferredModel);
      appendChat({ role: 'assistant', content: res, model: preferredModel, timestamp: new Date().toISOString() });
    } catch (e: any) {
      setError(e.message || 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) return <div className="p-8 text-neutral-500">Cargando…</div>;

  const apiKeyError = error?.includes('ANTHROPIC_API_KEY');

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Preguntar a Claude</h1>
          <p className="text-sm text-neutral-500">Tu sensei personal. Responde siempre en español.</p>
        </div>
        <div className="flex rounded-md border border-neutral-300 overflow-hidden text-xs">
          {(['sonnet', 'opus'] as const).map(m => (
            <button
              key={m}
              onClick={() => setModel(m)}
              className={`px-3 py-1.5 ${preferredModel === m ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {apiKeyError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          Tienes ANTHROPIC_API_KEY activa en tu shell. Ciérrala con <code>unset ANTHROPIC_API_KEY</code> y reinicia <code>npm run dev</code> para usar tu plan Max en vez de pagar API.
        </div>
      )}

      <div className="space-y-3">
        {chatHistory.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-6">Aún no hay conversación. Escribe algo abajo.</p>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-neutral-900 text-white ml-12'
                : 'bg-white border border-neutral-200 mr-12'
            }`}
          >
            {msg.content}
            {msg.role === 'assistant' && (
              <div className="mt-1 text-[10px] opacity-50">{msg.model}</div>
            )}
          </div>
        ))}
        {loading && <div className="text-sm text-neutral-500 italic">Claude está pensando…</div>}
      </div>

      <div className="sticky bottom-0 bg-neutral-50 pt-3 border-t border-neutral-200 space-y-2">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Escribe tu pregunta… (Cmd+Enter para enviar)"
          className="w-full h-24 rounded-md border border-neutral-300 p-3 text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">Modelo: {preferredModel}</span>
          <button
            onClick={send}
            disabled={!prompt.trim() || loading}
            className="rounded-md bg-neutral-900 text-white px-5 py-2 text-sm disabled:opacity-40"
          >
            {loading ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
