import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTeacher, TEACHER_PROMPT, type Command } from '../server/teacher';

for (const provider of ['claude', 'codex', 'cursor'] as const) {
  test(`${provider} runs the shared teacher and returns only its answer`, async () => {
    const calls: Command[] = [];
    const teacher = createTeacher({
      env: { PATH: '/bin', CLAUDE_CODE_OAUTH_TOKEN: 'fixture-credential', CURSOR_API_KEY: 'fixture-cursor' },
      run: async command => {
        calls.push(command);
        if (provider === 'codex') return '{"type":"thread.started"}\n{"type":"item.completed","item":{"type":"agent_message","text":"Tutor answer"}}\n';
        if (provider === 'cursor') return '{"type":"result","is_error":false,"result":"Tutor answer"}';
        return 'Tutor answer\n';
      }
    });
    assert.equal(await teacher.ask({ provider, prompt: 'Explain a greeting', model: provider === 'claude' ? 'sonnet' : undefined }), 'Tutor answer');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, { claude: 'claude', codex: 'codex', cursor: 'cursor-agent' }[provider]);
    assert.ok(calls[0].input.includes(TEACHER_PROMPT));
    assert.ok(calls[0].input.includes('Explain a greeting'));
    assert.ok(!calls[0].args.some(arg => arg.includes('fixture-') || arg.includes('Explain a greeting')));
    assert.equal(calls[0].env.ANTHROPIC_API_KEY, undefined);
    assert.equal(calls[0].env.CLAUDE_CODE_OAUTH_TOKEN, provider === 'claude' ? 'fixture-credential' : undefined);
    assert.equal(calls[0].env.CURSOR_API_KEY, provider === 'cursor' ? 'fixture-cursor' : undefined);
    if (provider !== 'claude') assert.ok(!calls[0].args.includes('sonnet'));
    if (provider === 'cursor') {
      assert.ok(calls[0].args.includes('--trust'));
      assert.ok(calls[0].args.includes('ask'));
      assert.ok(!calls[0].args.includes('--force'));
    }
  });
}

test('Claude refuses API billing before starting any process', async () => {
  let called = false;
  const teacher = createTeacher({ env: { ANTHROPIC_API_KEY: 'fixture-api' }, run: async () => { called = true; return ''; } });
  await assert.rejects(teacher.ask({ provider: 'claude', prompt: 'Greeting' }), /ANTHROPIC_API_KEY/);
  assert.equal(called, false);
});

test('Codex and Cursor work even when an unrelated Anthropic key is present', async () => {
  const teacher = createTeacher({ env: { ANTHROPIC_API_KEY: 'fixture-api' }, run: async c => {
    assert.equal(c.env.ANTHROPIC_API_KEY, undefined);
    return c.command === 'codex' ? '{"type":"item.completed","item":{"type":"agent_message","text":"Answer"}}' : '{"result":"Answer"}';
  } });
  for (const provider of ['codex', 'cursor'] as const) assert.equal(await teacher.ask({ provider, prompt: 'Greeting' }), 'Answer');
});

test('Claude reads its dedicated Keychain cache only when the environment token is absent', async () => {
  const calls: Command[] = [];
  const teacher = createTeacher({ platform: 'darwin', env: {}, run: async c => {
    calls.push(c);
    return c.command === '/usr/bin/security' ? 'fixture-cache\n' : 'Answer';
  } });
  assert.equal(await teacher.ask({ provider: 'claude', prompt: 'Greeting' }), 'Answer');
  assert.deepEqual(calls[0].args, ['find-generic-password', '-s', 'kana-sensei.claude-oauth', '-a', 'oauth', '-w']);
  assert.equal(calls[1].env.CLAUDE_CODE_OAUTH_TOKEN, 'fixture-cache');
  assert.ok(!calls[1].args.includes('fixture-cache'));
});

test('missing Claude credentials produce setup guidance without leaking subprocess output', async () => {
  const teacher = createTeacher({ env: {}, platform: 'darwin', run: async () => { throw new Error('private diagnostic'); } });
  await assert.rejects(teacher.ask({ provider: 'claude', prompt: 'Greeting' }), error => {
    assert.match(String(error), /CLAUDE_CODE_OAUTH_TOKEN/);
    assert.ok(!String(error).includes('private diagnostic'));
    return true;
  });
});

test('invalid requests never start a process', async () => {
  const teacher = createTeacher({ run: async () => { throw new Error('should not run'); }, env: {} });
  for (const request of [null, {}, { provider: 'unknown', prompt: 'Hi' }, { provider: 'codex', prompt: '' }, { provider: 'claude', prompt: 'Hi', model: 'bad' }, { provider: 'codex', prompt: 'Hi', model: 'sonnet' }]) {
    await assert.rejects(teacher.ask(request as any), /Invalid/);
  }
});

test('provider errors, empty answers and malformed output are safe', async () => {
  for (const provider of ['codex', 'cursor'] as const) {
    for (const output of ['', 'private diagnostic', '{"is_error":true,"result":"private diagnostic"}']) {
      const teacher = createTeacher({ env: {}, run: async () => output });
      await assert.rejects(teacher.ask({ provider, prompt: 'Hi' }), error => !String(error).includes('private diagnostic'));
    }
  }
  const teacher = createTeacher({ env: {}, run: async () => { throw new Error('private diagnostic'); } });
  await assert.rejects(teacher.ask({ provider: 'codex', prompt: 'Hi' }), /codex failed/);
});

test('subprocess stdin works from an isolated directory and cleanup follows exit', async () => {
  const { runCommand } = await import('../server/teacher');
  const { stat } = await import('node:fs/promises');
  const output = await runCommand({ command: process.execPath, args: ['-e',
    'let input="";process.stdin.on("data",d=>input+=d);process.stdin.on("end",()=>process.stdout.write(JSON.stringify({cwd:process.cwd(),input})))'],
    input: 'Synthetic lesson', env: { PATH: process.env.PATH } });
  const result = JSON.parse(output);
  assert.equal(result.input, 'Synthetic lesson');
  assert.notEqual(result.cwd, process.cwd());
  await assert.rejects(stat(result.cwd), /ENOENT/);
  await assert.rejects(runCommand({ command: process.execPath, args: ['-e', 'process.stderr.write("private diagnostic");process.exit(1)'], input: '', env: {} }), /CLI failed/);
  await assert.rejects(runCommand({ command: '/nonexistent-kana-cli', args: [], input: '', env: {} }), /CLI unavailable/);
});

test('Codex skips warning lines while preserving answer and failure events', async () => {
  const teacher = createTeacher({ env: {}, run: async () => 'Warning: synthetic notice\n\n  {"type":"item.completed","item":{"type":"agent_message","text":"Answer"}}\n' });
  assert.equal(await teacher.ask({ provider: 'codex', prompt: 'Hi' }), 'Answer');
  const failed = createTeacher({ env: {}, run: async () => 'Warning: synthetic notice\n{"type":"turn.failed"}' });
  await assert.rejects(failed.ask({ provider: 'codex', prompt: 'Hi' }), /codex failed/);
});

test('timeout rejects promptly and stops helpers holding stdout open', async () => {
  const { runCommand } = await import('../server/teacher');
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const directory = await mkdtemp(`${tmpdir()}/kana-timeout-test-`);
  const marker = `${directory}/heartbeat`;
  const pidsFile = `${directory}/pids.json`;
  const helperScript = 'const fs=require("node:fs");setInterval(()=>fs.appendFileSync(process.argv[1],"tick"),25)';
  const script = `const {spawn}=require('node:child_process');const fs=require('node:fs');
    const helper=spawn(process.execPath,['-e',${JSON.stringify(helperScript)},process.argv[1]],{stdio:'inherit'});
    fs.writeFileSync(process.argv[2],JSON.stringify([process.pid,helper.pid]));setInterval(()=>{},1000);`;
  const running = runCommand({ command: process.execPath, args: ['-e', script, marker, pidsFile], input: '', env: { PATH: process.env.PATH } }, 1000);
  let watchdog: ReturnType<typeof setTimeout>;
  try {
    const deadline = new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('Runner did not reject promptly')), 2500); });
    await assert.rejects(Promise.race([running, deadline]), /CLI failed or timed out/);
    await new Promise(resolve => setTimeout(resolve, 50));
    const before = await readFile(marker, 'utf8');
    assert.ok(before.includes('tick'));
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(await readFile(marker, 'utf8'), before, 'helper must stop after timeout');
  } finally {
    clearTimeout(watchdog!);
    try {
      for (const pid of JSON.parse(await readFile(pidsFile, 'utf8'))) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* Already stopped. */ }
      }
    } catch { /* Process failed before creating the fixture. */ }
    await running.catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
