import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import memoryPlugin from '../vite-memory-plugin';

for (const provider of ['codex', 'cursor'] as const) {
  test(`HTTP teacher endpoint dispatches ${provider}`, async () => {
    const calls: unknown[] = [];
    const server = await createServer({ configFile: false, plugins: [memoryPlugin({
      ask: async request => { calls.push(request); return 'Tutor answer'; }
    })], server: { host: '127.0.0.1', port: 0 } });
    try {
      await server.listen();
      const address = server.httpServer!.address() as { port: number };
      const response = await fetch(`http://127.0.0.1:${address.port}/api/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, prompt: 'Explain a greeting' })
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { response: 'Tutor answer', provider });
      assert.deepEqual(calls, [{ provider, prompt: 'Explain a greeting' }]);
    } finally { await server.close(); }
  });
}

test('legacy Claude endpoint, method guards and malformed requests remain usable', async () => {
  const { createTeacher } = await import('../server/teacher');
  const teacher = createTeacher({ env: { CLAUDE_CODE_OAUTH_TOKEN: 'fixture-credential' }, run: async () => 'Tutor answer' });
  const server = await createServer({ configFile: false, plugins: [memoryPlugin(teacher)], server: { host: '127.0.0.1', port: 0 } });
  try {
    await server.listen();
    const address = server.httpServer!.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    const legacy = await fetch(`${base}/api/ask-claude`, { method: 'POST', body: JSON.stringify({ prompt: 'Explain a greeting', model: 'sonnet' }) });
    assert.equal(legacy.status, 200);
    assert.deepEqual(await legacy.json(), { response: 'Tutor answer', provider: 'claude' });
    assert.equal((await fetch(`${base}/api/ask`)).status, 405);
    for (const body of ['{', 'null', '{"prompt":"Hi","provider":"unknown"}']) {
      const response = await fetch(`${base}/api/ask`, { method: 'POST', body });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /^Invalid/);
    }
  } finally { await server.close(); }
});
