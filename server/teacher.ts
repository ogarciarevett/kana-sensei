import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type Provider = 'claude' | 'codex' | 'cursor';
export type TeacherRequest = { provider?: Provider; prompt: string; model?: 'sonnet' | 'opus' };
export interface Teacher { ask(request: TeacherRequest): Promise<string> }
export type Command = { command: string; args: string[]; input: string; env: NodeJS.ProcessEnv };
type Runner = (command: Command) => Promise<string>;

export const TEACHER_PROMPT = 'You are a Japanese tutor for a Spanish-speaking beginner (A1/A2). Always reply in Spanish. If the user wrote Japanese, correct any errors with a clear explanation. Use anime references (Naruto, JJK, Death Note, One Piece, Demon Slayer, AoT, FMA, Evangelion, Ghibli, HxH, Berserk) when they help memorization. If the user wrote romaji, echo it back in kana. Keep English only for technical terms without a clean Spanish equivalent. Be concise. Answer the lesson question directly without using tools or accessing files.';

// Capture subprocess output internally. Never forward CLI diagnostics to the browser.
export async function runCommand({ command, args, input, env }: Command, timeoutMs = 120_000): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), 'kana-sensei-'));
  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(command, args, { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      let size = 0;
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        try {
          if (child.pid) process.kill(-child.pid, 'SIGKILL');
        } catch { child.kill('SIGKILL'); }
        reject(new Error('CLI failed or timed out'));
      };
      const timer = setTimeout(stop, timeoutMs);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        size += Buffer.byteLength(chunk);
        if (size > 2_000_000) stop();
        else output += chunk.toString();
      });
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.on('error', () => { clearTimeout(timer); reject(new Error('CLI unavailable')); });
      child.on('close', code => {
        clearTimeout(timer);
        if (stopped || code !== 0) reject(new Error('CLI failed or timed out'));
        else resolve(output);
      });
      child.stdin.end(input);
    });
  } finally { await rm(cwd, { recursive: true, force: true }); }
};

function environment(source: NodeJS.ProcessEnv, provider: Provider): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  // Authentication belongs to the selected CLI, never to the browser or argv.
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'USER', 'SHELL',
    ...(provider === 'claude' ? ['CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR'] : []),
    ...(provider === 'codex' ? ['CODEX_HOME'] : []),
    ...(provider === 'cursor' ? ['CURSOR_API_KEY'] : [])]) {
    if (source[key]) env[key] = source[key];
  }
  return env;
}

function codexAnswer(output: string): string {
  const answers: string[] = [];
  for (const line of output.trim().split('\n')) {
    if (!line.trimStart().startsWith('{')) continue;
    const event = JSON.parse(line);
    if (event.type === 'error' || event.type === 'turn.failed') throw new Error('Failed turn');
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') answers.push(event.item.text);
  }
  return answers.join('\n\n');
}

function cursorAnswer(output: string): string {
  const result = JSON.parse(output);
  if (result.is_error || typeof result.result !== 'string') throw new Error('Failed turn');
  return result.result;
}

export function createTeacher(options: { env?: NodeJS.ProcessEnv; platform?: string; run?: Runner } = {}): Teacher {
  const source = options.env ?? process.env;
  const run = options.run ?? runCommand;
  const platform = options.platform ?? process.platform;
  const adapters: Record<Provider, (request: TeacherRequest, env: NodeJS.ProcessEnv, input: string) => Promise<string>> = {
    claude: async (request, env, input) => {
      if (source.ANTHROPIC_API_KEY?.trim()) throw new Error('ANTHROPIC_API_KEY is set. Unset it and restart the dev server to use your subscription.');
      if (!env.CLAUDE_CODE_OAUTH_TOKEN?.trim() && platform === 'darwin') {
        try {
          env.CLAUDE_CODE_OAUTH_TOKEN = (await run({ command: '/usr/bin/security',
            args: ['find-generic-password', '-s', 'kana-sensei.claude-oauth', '-a', 'oauth', '-w'], input: '', env })).trim();
        } catch { /* Missing or locked cache: return setup guidance below. */ }
      }
      if (!env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) throw new Error('Set CLAUDE_CODE_OAUTH_TOKEN from your secret manager or unlock the kana-sensei.claude-oauth Keychain cache.');
      return run({ command: 'claude', args: ['-p', '--model', request.model ?? 'sonnet', '--output-format', 'text', '--tools', '', '--no-session-persistence'], input, env });
    },
    codex: async (_request, env, input) => codexAnswer(await run({ command: 'codex',
      args: ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '--json', '-'], input, env })),
    cursor: async (_request, env, input) => cursorAnswer(await run({ command: 'cursor-agent',
      args: ['--print', '--trust', '--mode', 'ask', '--output-format', 'json'], input, env }))
  };
  return {
    async ask(request) {
      const provider = request?.provider ?? 'claude';
      if (!request || !['claude', 'codex', 'cursor'].includes(provider) || typeof request.prompt !== 'string' ||
        !request.prompt.trim() || request.prompt.length > 20_000 ||
        (request.model !== undefined && (provider !== 'claude' || !['sonnet', 'opus'].includes(request.model)))) {
        throw new Error('Invalid teacher request');
      }
      try {
        const answer = (await adapters[provider](request, environment(source, provider), `${TEACHER_PROMPT}\n\nLesson question:\n${request.prompt}`)).trim();
        if (!answer) throw new Error('Empty answer');
        return answer;
      } catch (error) {
        // Our own Claude setup errors contain names only, no credential values.
        if (provider === 'claude' && error instanceof Error && /^(ANTHROPIC_API_KEY is set|Set CLAUDE_CODE_OAUTH_TOKEN)/.test(error.message)) throw error;
        throw new Error(`${provider} failed. Check CLI installation and authentication, then retry.`);
      }
    }
  };
}
