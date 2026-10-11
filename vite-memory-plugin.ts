import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTeacher, type Teacher } from './server/teacher';
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

export default function memoryPlugin(teacher: Teacher = createTeacher()): Plugin {
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

      const ask = async (req: any, res: any) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
        try {
          const body = JSON.parse(await readBody(req));
          const response = await teacher.ask(body);
          json(res, 200, { response, provider: body.provider ?? 'claude' });
        } catch (error) {
          const message = error instanceof SyntaxError ? 'Invalid JSON request' :
            error instanceof Error ? error.message : 'Teacher failed';
          json(res, message.startsWith('Invalid') || message.startsWith('ANTHROPIC_API_KEY') ? 400 : 500, { error: message });
        }
      };
      server.middlewares.use('/api/ask', ask);
      server.middlewares.use('/api/ask-claude', ask);

      // Keep reference so unused import warning stays quiet if needed.
      void SESSIONS_DIR;
    }
  };
}
