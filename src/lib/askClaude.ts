import { askTeacher } from './askTeacher';

// Compatibility for existing callers.
export const askClaude = (prompt: string, model: 'sonnet' | 'opus' = 'sonnet') => askTeacher(prompt, 'claude', model);
