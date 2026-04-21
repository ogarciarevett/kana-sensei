import type { AppState } from './types';

let writeTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadState(): Promise<AppState | null> {
  const r = await fetch('/api/state');
  if (!r.ok) throw new Error('load failed');
  return r.json();
}

export function saveStateDebounced(state: AppState, delayMs = 500): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    const r = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state, null, 2)
    });
    if (!r.ok) console.error('save failed', await r.text());
  }, delayMs);
}

export async function saveQuest(date: string, markdown: string) {
  const r = await fetch(`/api/quests?date=${date}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/markdown' },
    body: markdown
  });
  if (!r.ok) throw new Error((await r.json()).error);
}
