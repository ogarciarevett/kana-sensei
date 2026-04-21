export async function askClaude(
  prompt: string,
  model: 'sonnet' | 'opus' = 'sonnet'
): Promise<string> {
  const r = await fetch('/api/ask-claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'ask-claude failed');
  return data.response;
}
