import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import type { Plugin, ViteDevServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.resolve(__dirname, 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'progress.json');
const QUESTS_DIR = path.join(MEMORY_DIR, 'quests');
const SESSIONS_DIR = path.join(MEMORY_DIR, 'sessions');

async function ensureDirs() {
  await fs.mkdir(MEMORY_DIR, { recursive: true });
  await fs.mkdir(QUESTS_DIR, { recursive: true });
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

async function readBody(req: any): Promise<string> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

function json(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default function memoryPlugin(): Plugin {
  return {
    name: 'kana-sensei-memory',
    configureServer(server: ViteDevServer) {
      ensureDirs().catch(console.error);

      // ── /api/state ──────────────────────────────────────────
      server.middlewares.use('/api/state', async (req, res) => {
        try {
          if (req.method === 'GET') {
            try {
              const data = await fs.readFile(STATE_FILE, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
            } catch {
              res.setHeader('Content-Type', 'application/json');
              res.end('null');  // signals "no file yet"
            }
            return;
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            JSON.parse(body); // validate it parses
            await fs.writeFile(STATE_FILE, body, 'utf-8');
            return json(res, 200, { ok: true });
          }
          json(res, 405, { error: 'method not allowed' });
        } catch (e: any) {
          json(res, 500, { error: e.message });
        }
      });

      // ── /api/quests ─────────────────────────────────────────
      server.middlewares.use('/api/quests', async (req, res) => {
        try {
          const url = new URL(req.url!, 'http://localhost');
          if (req.method === 'GET') {
            const files = await fs.readdir(QUESTS_DIR);
            return json(res, 200, files.filter(f => f.endsWith('.md')).sort().reverse());
          }
          if (req.method === 'POST') {
            const date = url.searchParams.get('date');
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
              return json(res, 400, { error: 'date param must be YYYY-MM-DD' });
            }
            const body = await readBody(req);
            await fs.writeFile(path.join(QUESTS_DIR, `${date}.md`), body, 'utf-8');
            return json(res, 200, { ok: true });
          }
          json(res, 405, { error: 'method not allowed' });
        } catch (e: any) {
          json(res, 500, { error: e.message });
        }
      });

      // ── /api/ask-claude ─────────────────────────────────────
      server.middlewares.use('/api/ask-claude', async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

        // Hard guard — refuse to run if the API key env var is set.
        if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '') {
          return json(res, 400, {
            error: 'ANTHROPIC_API_KEY is set in the environment. Unset it and restart the dev server — otherwise this would bill your API account instead of using your Max subscription.'
          });
        }

        try {
          const body = JSON.parse(await readBody(req));
          const prompt: string = body.prompt;
          const model: 'sonnet' | 'opus' = body.model || 'sonnet';
          if (!prompt || typeof prompt !== 'string') {
            return json(res, 400, { error: 'prompt required' });
          }

          const systemPrompt = `You are a Japanese tutor for a Spanish-speaking beginner (A1/A2). Always reply in Spanish. If the user wrote Japanese, correct any errors with a clear explanation. Use anime references (Naruto, JJK, Death Note, One Piece, Demon Slayer, AoT, FMA, Evangelion, Ghibli, HxH, Berserk) when they help memorization. If the user wrote romaji, echo it back in kana. Keep English only for technical terms without a clean Spanish equivalent. Be concise.`;

          const child = spawn('claude', [
            '-p', prompt,
            '--model', model,
            '--append-system-prompt', systemPrompt,
            '--output-format', 'text'
          ], {
            env: { ...process.env, ANTHROPIC_API_KEY: '' }
          });

          let out = '';
          let err = '';
          child.stdout.on('data', d => (out += d.toString()));
          child.stderr.on('data', d => (err += d.toString()));

          child.on('close', code => {
            if (code !== 0) {
              return json(res, 500, { error: err.trim() || `claude exited ${code}` });
            }
            json(res, 200, { response: out.trim(), model });
          });
        } catch (e: any) {
          json(res, 500, { error: e.message });
        }
      });

      // Keep reference so unused import warning stays quiet if needed.
      void SESSIONS_DIR;
    }
  };
}
