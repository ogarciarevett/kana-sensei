export type Script = "hiragana" | "katakana" | "kanji";
export type Grade = "again" | "hard" | "good" | "easy";

export type KanaInfo = {
  char: string;
  reading: string;
  row: string;
  script: Script;
  mnemonic: string;
  example_word: { word: string; reading: string; meaning: string };
  anime_ref?: string;
};

export type ProgressEntry = {
  char: string;
  script: Script;
  reading: string;
  meaning?: string;
  seen: number;
  correct: number;
  incorrect: number;
  interval_hours: number;
  due_at: string;
  ease: number;
  first_seen: string;
  last_grade?: Grade;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  model: string;
  provider?: "claude" | "codex" | "cursor";
  timestamp: string;
};

export type AppState = {
  user: {
    name: string;
    started_on: string;
    streak: number;
    last_session: string;
  };
  progress: Record<string, ProgressEntry>;
  settings: {
    mode: "recognition" | "recall" | "writing" | "mixed";
    daily_goal: number;
    preferred_model: "sonnet" | "opus";
  };
  session_log: { date: string; chars_reviewed: number; accuracy: number }[];
  chat_history: ChatMessage[];
};
