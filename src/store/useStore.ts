import { create } from 'zustand';
import type { AppState, Grade } from '../lib/types';
import { loadState, saveStateDebounced } from '../lib/memoryClient';
import { applyGrade, newEntry } from '../lib/srs';

const DEFAULT_STATE: AppState = {
  user: { name: 'Santiago', started_on: '2026-04-17', streak: 0, last_session: '' },
  progress: {},
  settings: { mode: 'recognition', daily_goal: 10, preferred_model: 'sonnet' },
  session_log: [],
  chat_history: []
};

type Store = AppState & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  gradeChar: (char: string, grade: Grade) => void;
  introduceChar: (char: string, reading: string, script: 'hiragana' | 'katakana' | 'kanji', meaning?: string) => void;
  rescheduleNow: (chars: string[]) => void;
  setMode: (mode: AppState['settings']['mode']) => void;
  setModel: (m: 'sonnet' | 'opus') => void;
  appendChat: (msg: AppState['chat_history'][0]) => void;
  logSession: (entry: AppState['session_log'][0]) => void;
};

// Module-level guard so concurrent hydrate() calls (React 18 StrictMode
// double-invokes useEffect on mount) share a single in-flight fetch and
// cannot race to overwrite in-memory progress with a stale DEFAULT_STATE.
let hydratePromise: Promise<void> | null = null;

export const useStore = create<Store>((set, get) => ({
  ...DEFAULT_STATE,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      const loaded = await loadState();
      if (get().hydrated) return; // another call completed while we awaited
      if (loaded) {
        set({ ...loaded, hydrated: true });
      } else {
        set({ hydrated: true });
        saveStateDebounced({ ...DEFAULT_STATE }, 0);
      }
    })();
    return hydratePromise;
  },

  gradeChar: (char, grade) => {
    const entry = get().progress[char];
    if (!entry) return;
    const updated = applyGrade(entry, grade);
    const progress = { ...get().progress, [char]: updated };
    set({ progress });
    saveStateDebounced(stripStore({ ...get(), progress }));
  },

  introduceChar: (char, reading, script, meaning) => {
    if (get().progress[char]) return;
    const entry = newEntry(char, reading, script, meaning);
    const progress = { ...get().progress, [char]: entry };
    set({ progress });
    saveStateDebounced(stripStore({ ...get(), progress }));
  },

  rescheduleNow: (chars) => {
    const now = new Date(Date.now() - 3600_000).toISOString(); // 1h ago so it sorts first
    const current = get().progress;
    const progress = { ...current };
    let changed = false;
    for (const char of chars) {
      const entry = current[char];
      if (!entry) continue;
      progress[char] = { ...entry, due_at: now };
      changed = true;
    }
    if (!changed) return;
    set({ progress });
    saveStateDebounced(stripStore({ ...get(), progress }));
  },

  setMode: (mode) => {
    const settings = { ...get().settings, mode };
    set({ settings });
    saveStateDebounced(stripStore({ ...get(), settings }));
  },

  setModel: (preferred_model) => {
    const settings = { ...get().settings, preferred_model };
    set({ settings });
    saveStateDebounced(stripStore({ ...get(), settings }));
  },

  appendChat: (msg) => {
    const chat_history = [...get().chat_history, msg].slice(-20);
    set({ chat_history });
    saveStateDebounced(stripStore({ ...get(), chat_history }));
  },

  logSession: (entry) => {
    const session_log = [...get().session_log, entry].slice(-90);
    set({ session_log });
    saveStateDebounced(stripStore({ ...get(), session_log }));
  }
}));

function stripStore(s: Store | (AppState & Partial<Store>)): AppState {
  const { hydrated, hydrate, gradeChar, introduceChar, rescheduleNow, setMode, setModel, appendChat, logSession, ...rest } = s as any;
  void hydrated; void hydrate; void gradeChar; void introduceChar; void rescheduleNow; void setMode; void setModel; void appendChat; void logSession;
  return rest;
}
