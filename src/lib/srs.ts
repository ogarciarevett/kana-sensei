import type { ProgressEntry, Grade } from './types';

export function applyGrade(entry: ProgressEntry, grade: Grade): ProgressEntry {
  let { interval_hours, ease } = entry;
  switch (grade) {
    case 'again':
      interval_hours = 0.1;
      ease = Math.max(1.3, ease - 0.2);
      break;
    case 'hard':
      interval_hours = Math.max(1, interval_hours * 1.2);
      ease = Math.max(1.3, ease - 0.15);
      break;
    case 'good':
      interval_hours = interval_hours < 1 ? 24 : interval_hours * ease;
      break;
    case 'easy':
      interval_hours = interval_hours < 1 ? 72 : interval_hours * ease * 1.3;
      ease += 0.15;
      break;
  }
  return {
    ...entry,
    interval_hours,
    ease,
    due_at: new Date(Date.now() + interval_hours * 3600_000).toISOString(),
    last_grade: grade,
    seen: entry.seen + 1,
    correct: entry.correct + (grade !== 'again' ? 1 : 0),
    incorrect: entry.incorrect + (grade === 'again' ? 1 : 0),
  };
}

export function isDue(entry: ProgressEntry, now = new Date()): boolean {
  return new Date(entry.due_at).getTime() <= now.getTime();
}

export function newEntry(
  char: string,
  reading: string,
  script: 'hiragana' | 'katakana' | 'kanji',
  meaning?: string
): ProgressEntry {
  const now = new Date().toISOString();
  return {
    char,
    reading,
    script,
    meaning,
    seen: 0,
    correct: 0,
    incorrect: 0,
    interval_hours: 0.1,
    due_at: now,
    ease: 2.5,
    first_seen: now,
  };
}
