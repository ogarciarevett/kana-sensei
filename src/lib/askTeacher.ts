import type { Provider } from '../../server/teacher';

export async function askTeacher(prompt: string, provider: Provider, model: 'sonnet' | 'opus' = 'sonnet'): Promise<string> {
  const response = await fetch('/api/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, provider, ...(provider === 'claude' ? { model } : {}) })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Teacher request failed');
  return data.response;
}
