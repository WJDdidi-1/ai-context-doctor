import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply, formatNotice, decideRead, formatDenial, getSkippedReads, resetSkipLog } from '../index.js';

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-plugin-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

function harness(config) {
  const listeners = {};
  const guards = [];
  const ctx = {
    on(event, callback) {
      listeners[event] = callback;
    },
    tools: {
      guard(fn) {
        guards.push(fn);
      }
    }
  };
  apply(ctx, config);
  const emit = (payload) => listeners['agent/created'](payload);
  emit.guards = guards;
  return emit;
}

function readCall({ cwd, filePath }) {
  return { name: 'read', arguments: { file_path: filePath }, agent: { session: { meta: { cwd } } } };
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

test('decideRead blocks generated output, lockfiles and logs', () => {
  const cwd = makeRepo({
    'dist/app.js': 'x'.repeat(2048),
    'package-lock.json': 'x'.repeat(512),
    'logs/dev.log': 'x'.repeat(256),
    'src/index.js': 'const a = 1;\n',
    '.env.example': 'PORT=3000\n'
  });

  const blocked = ['dist/app.js', 'package-lock.json', 'logs/dev.log'].map((filePath) =>
    decideRead({ root: cwd, filePath })
  );

  assert.deepEqual(
    blocked.map((decision) => decision.block && decision.relativePath),
    ['dist/app.js', 'package-lock.json', 'logs/dev.log']
  );
  assert.equal(blocked[0].reason, 'generated build output');
  assert.ok(blocked[0].tokens.min > 0);

  assert.equal(decideRead({ root: cwd, filePath: 'src/index.js' }).block, false);
  // Templates are review-only: blocking them would hide real configuration.
  assert.equal(decideRead({ root: cwd, filePath: '.env.example' }).block, false);
  // Paths outside the workspace are another project's business.
  assert.equal(decideRead({ root: cwd, filePath: '../elsewhere.txt' }).block, false);
  // Missing files belong to the read tool's own error message.
  assert.equal(decideRead({ root: cwd, filePath: 'nope.js' }).block, false);
});

test('the guard denies a read and records it', () => {
  resetSkipLog();
  const cwd = makeRepo({ 'dist/app.js': 'x'.repeat(4096), 'src/index.js': 'ok\n' });
  const emit = harness();
  assert.equal(emit.guards.length, 1);

  const [guard] = emit.guards;
  const reason = guard(readCall({ cwd, filePath: 'dist/app.js' }));

  assert.match(reason, /Skipped dist\/app\.js/);
  assert.match(reason, /generated build output/);
  assert.match(reason, /tokens/);
  assert.equal(guard(readCall({ cwd, filePath: 'src/index.js' })), undefined);
  assert.deepEqual(getSkippedReads(cwd).map((item) => item.path), ['dist/app.js']);
});

test('the guard ignores other tools and honours readPolicy off', () => {
  const cwd = makeRepo({ 'dist/app.js': 'x'.repeat(4096) });

  const emit = harness();
  const [guard] = emit.guards;
  assert.equal(guard({ name: 'bash', arguments: { command: 'cat dist/app.js' }, agent: { session: { meta: { cwd } } } }), undefined);
  assert.equal(guard({ name: 'read', arguments: {}, agent: { session: { meta: { cwd } } } }), undefined);

  const off = harness({ readPolicy: 'off' });
  assert.equal(off.guards[0](readCall({ cwd, filePath: 'dist/app.js' })), undefined);
});

test('formatDenial states the size, reason and token range', () => {
  const text = formatDenial({ relativePath: 'build/main.js', bytes: 2 * 1024 * 1024, reason: 'large file', tokens: { min: 485000, max: 681000 } });

  assert.match(text, /build\/main\.js/);
  assert.match(text, /2\.0 MB/);
  assert.match(text, /485,000–681,000 tokens/);
});
