import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { askTeacher } from '../lib/askTeacher';
import type { Provider } from '../../server/teacher';

export function AskTeacher() {
  const hydrated = useStore(s => s.hydrated);
  const hydrate = useStore(s => s.hydrate);
  const chatHistory = useStore(s => s.chat_history);
  const appendChat = useStore(s => s.appendChat);
  const preferredModel = useStore(s => s.settings.preferred_model);
  const setModel = useStore(s => s.setModel);

  const [provider, setProvider] = useState<Provider>('claude');
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
    appendChat({ role: 'user', content: userMsg, provider, model: provider === 'claude' ? preferredModel : 'default', timestamp: new Date().toISOString() });
    try {
      const res = await askTeacher(userMsg, provider, preferredModel);
      appendChat({ role: 'assistant', content: res, provider, model: provider === 'claude' ? preferredModel : 'default', timestamp: new Date().toISOString() });
    } catch (e: any) {
      setError(e.message || 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) return <div className="p-8 text-neutral-500">Loading…</div>;

  const apiKeyError = error?.includes('ANTHROPIC_API_KEY');

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ask your teacher</h1>
          <p className="text-sm text-neutral-500">Your personal Japanese teacher. Explanations in Spanish.</p>
        </div>
        <label className="text-xs">
          Provider
          <select aria-label="Provider" value={provider} disabled={loading}
            onChange={event => setProvider(event.target.value as Provider)}
            className="ml-2 rounded-md border border-neutral-300 p-2">
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
            <option value="cursor">Cursor</option>
          </select>
        </label>
        {provider === 'claude' && <div className="flex rounded-md border border-neutral-300 overflow-hidden text-xs">
          {(['sonnet', 'opus'] as const).map(m => (
            <button
              key={m}
              disabled={loading}
              onClick={() => setModel(m)}
              className={`px-3 py-1.5 ${preferredModel === m ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600'}`}
            >
              {m}
            </button>
          ))}
        </div>}
      </header>

      {apiKeyError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          ANTHROPIC_API_KEY is active in your shell. Run <code>unset ANTHROPIC_API_KEY</code> and restart <code>bun run dev</code> to use your subscription.
        </div>
      )}

      <div className="space-y-3">
        {chatHistory.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-6">No conversation yet. Ask a question below.</p>
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
              <div className="mt-1 text-[10px] opacity-50">{msg.provider ?? 'claude'} · {msg.model}</div>
            )}
          </div>
        ))}
        {loading && <div className="text-sm text-neutral-500 italic">Your teacher is thinking…</div>}
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
          placeholder="Ask a question… (Cmd+Enter to send)"
          className="w-full h-24 rounded-md border border-neutral-300 p-3 text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">Provider: {provider}{provider === 'claude' ? ` · ${preferredModel}` : ''}</span>
          <button
            onClick={send}
            disabled={!prompt.trim() || loading}
            className="rounded-md bg-neutral-900 text-white px-5 py-2 text-sm disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
