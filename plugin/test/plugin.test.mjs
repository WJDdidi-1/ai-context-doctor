import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply, formatNotice } from '../index.js';

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-plugin-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

function harness() {
  const listeners = {};
  const ctx = {
    on(event, callback) {
      listeners[event] = callback;
    }
  };
  apply(ctx);
  return (payload) => listeners['agent/created'](payload);
}

function fakeAgent(cwd) {
  const calls = [];
  return {
    calls,
    session: { meta: { cwd } },
    inject(message) {
      calls.push(message);
    }
  };
}

test('injects one notice when the workspace is noisy', () => {
  const cwd = makeRepo({
    'src/index.js': 'const a = 1;\n',
    'package-lock.json': 'x'.repeat(4000)
  });
  const emit = harness();
  const agent = fakeAgent(cwd);

  emit({ agent });

  assert.equal(agent.calls.length, 1);
  const message = agent.calls[0];
  assert.equal(message.source.kind, 'ai-context-doctor');
  assert.match(message.content[0].text, /scores \d+\/100/);
  assert.match(message.content[0].text, /package-lock\.json/);
});

test('stays silent for a clean workspace', () => {
  const cwd = makeRepo({ 'src/index.js': 'const a = 1;\n' });
  const emit = harness();
  const agent = fakeAgent(cwd);

  emit({ agent });

  assert.equal(agent.calls.length, 0);
});

test('inspects each workspace only once', () => {
  const cwd = makeRepo({ 'package-lock.json': 'x'.repeat(4000) });
  const emit = harness();
  const first = fakeAgent(cwd);
  const second = fakeAgent(cwd);

  emit({ agent: first });
  emit({ agent: second });

  assert.equal(first.calls.length, 1);
  assert.equal(second.calls.length, 0);
});

test('ignores agents without a workspace and never throws', () => {
  const emit = harness();

  assert.doesNotThrow(() => emit({ agent: {} }));
  assert.doesNotThrow(() => emit({ agent: { session: { meta: {} } } }));
  assert.doesNotThrow(() => emit({}));
  assert.doesNotThrow(() => emit({ agent: { session: { meta: { cwd: '/definitely/not/here' } }, inject() { throw new Error('boom'); } } }));
});

test('formatNotice summarises the report for the model', () => {
  const text = formatNotice({
    healthScore: 42,
    noisePercent: 58,
    scannedBytes: 2048,
    scannedFiles: 7,
    topNoise: [{ path: 'dist/', bytes: 1024, reason: 'generated build output' }],
    suggestedAiignore: ['dist/', '*.log']
  });

  assert.match(text, /42\/100/);
  assert.match(text, /58%/);
  assert.match(text, /dist\/ \(1\.0 KB, generated build output\)/);
  assert.match(text, /Suggested \.aiignore: dist\/, \*\.log\./);
});
