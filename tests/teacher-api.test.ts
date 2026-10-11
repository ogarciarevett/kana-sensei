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
    const legacy = await fetch(`${base}/api/ask-claude`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Explain a greeting', model: 'sonnet' }) });
    assert.equal(legacy.status, 200);
    assert.deepEqual(await legacy.json(), { response: 'Tutor answer', provider: 'claude' });
    assert.equal((await fetch(`${base}/api/ask`)).status, 405);
    for (const body of ['{', 'null', '{"prompt":"Hi","provider":"unknown"}']) {
      const response = await fetch(`${base}/api/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /^Invalid/);
    }
  } finally { await server.close(); }
});

for (const endpoint of ['/api/ask', '/api/ask-claude']) {
  for (const scenario of [
    { name: 'text/plain body', headers: {}, status: 415 },
    { name: 'non-JSON media type prefix', headers: { 'Content-Type': 'application/json-evil' }, status: 415 },
    { name: 'cross-origin page', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, status: 403 },
    { name: 'opaque origin', headers: { 'Content-Type': 'application/json', Origin: 'null' }, status: 403 },
    { name: 'wrong local port', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:1' }, status: 403 },
    { name: 'wrong local Host port', headers: { 'Content-Type': 'application/json', Host: 'localhost:1' }, status: 403 },
    { name: 'DNS rebinding host', headers: { 'Content-Type': 'application/json', Host: 'example.com' }, status: 403 }
  ]) {
    test(`${endpoint} rejects ${scenario.name} before calling the teacher`, async () => {
      let calls = 0;
      const server = await createServer({ configFile: false, plugins: [memoryPlugin({
        ask: async () => { calls++; return 'Tutor answer'; }
      })], server: { host: '127.0.0.1', port: 0, allowedHosts: true } });
      try {
        await server.listen();
        const address = server.httpServer!.address() as { port: number };
        const response = await fetch(`http://127.0.0.1:${address.port}${endpoint}`, {
          method: 'POST', headers: scenario.headers,
          body: '{"provider":"codex","prompt":"Hi"}'
        });
        assert.equal(response.status, scenario.status);
        assert.equal(calls, 0);
      } finally { await server.close(); }
    });
  }
}

test('local browser origins and JSON charset parameters are accepted', async () => {
  let calls = 0;
  const server = await createServer({ configFile: false, plugins: [memoryPlugin({ ask: async () => { calls++; return 'Answer'; } })], server: { host: '127.0.0.1', port: 0 } });
  try {
    await server.listen();
    const { port } = server.httpServer!.address() as { port: number };
    for (const host of ['127.0.0.1', 'localhost']) {
      const response = await fetch(`http://127.0.0.1:${port}/api/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Origin: `http://${host}:${port}`, Host: `${host}:${port}` },
        body: '{"provider":"codex","prompt":"Hi"}'
      });
      assert.equal(response.status, 200);
    }
    assert.equal(calls, 2);
  } finally { await server.close(); }
});

for (const endpoint of ['/api/state', '/api/quests']) {
  test(`${endpoint} rejects hostile origins without changing learner data`, async () => {
    const server = await createServer({ configFile: false, plugins: [memoryPlugin()], server: { host: '127.0.0.1', port: 0 } });
    try {
      await server.listen();
      const { port } = server.httpServer!.address() as { port: number };
      const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, body: '{'
      });
      assert.equal(response.status, 403);
      if (endpoint === '/api/state') {
        const plain = await fetch(`http://127.0.0.1:${port}${endpoint}`, { method: 'POST', body: '{' });
        assert.equal(plain.status, 415);
      }
    } finally { await server.close(); }
  });
}
