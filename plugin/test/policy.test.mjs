import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-home-'));

const { readPolicy, writePolicy, optimizeWorkspace, undoOptimize, decideRead } = await import('../index.js');
const { scanRepository } = await import('ai-context-doctor');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-repo-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

test('a workspace with no policy file uses the recommended strength', () => {
  const cwd = makeRepo({ 'a.js': 'x' });
  assert.equal(readPolicy(cwd), 3);
});

test('the policy round-trips and ignores a value it does not know', () => {
  const cwd = makeRepo({ 'a.js': 'x' });
  assert.equal(writePolicy(cwd, 5).key, 'strict');
  assert.equal(readPolicy(cwd), 5);

  fs.writeFileSync(path.join(cwd, '.aiignore.policy.json'), '{"level": 42}');
  assert.equal(readPolicy(cwd), 3, 'an unknown level falls back to balanced');
});

test('the strength decides what the guard stops', () => {
  const cwd = makeRepo({
    'dist/bundle.js': 'x'.repeat(1000),
    'src/big.js': 'y'.repeat(200 * 1024),
    'src/small.js': 'z'.repeat(100)
  });
  const root = cwd;

  // Off: only .aiignore rules apply.
  assert.equal(decideRead({ root, filePath: 'dist/bundle.js', level: 1 }).block, false);

  // Balanced: build output is stopped, a 200 KB source file is not.
  assert.equal(decideRead({ root, filePath: 'dist/bundle.js', level: 3 }).block, true);
  assert.equal(decideRead({ root, filePath: 'src/big.js', level: 3 }).block, false);

  // Strict: the 200 KB file now exceeds the 64 KB limit.
  const strict = decideRead({ root, filePath: 'src/big.js', level: 5 });
  assert.equal(strict.block, true);
  assert.match(strict.reason, /strict limit/);
  assert.equal(decideRead({ root, filePath: 'src/small.js', level: 5 }).block, false);
});

test('a hand-written rule still wins at every strength', () => {
  const cwd = makeRepo({ 'src/keep.js': 'x' });
  const blocked = decideRead({ root: cwd, filePath: 'src/keep.js', rules: ['src/keep.js'], level: 1 });
  assert.equal(blocked.block, true);
  assert.equal(blocked.reason, 'listed in .aiignore');
});

test('optimize writes the rules, and undo puts the file back byte for byte', () => {
  const cwd = makeRepo({
    'src/index.js': 'const a = 1;\n',
    'package-lock.json': 'x'.repeat(4000),
    'logs/dev.log': 'line\n'
  });
  const before = '# my own rules\nsrc/generated/\n';
  fs.writeFileSync(path.join(cwd, '.aiignore'), before);

  const report = scanRepository(cwd);
  const result = optimizeWorkspace(cwd, report);
  assert.equal(result.written, true);
  assert.ok(result.added.includes('package-lock.json'));

  const after = fs.readFileSync(path.join(cwd, '.aiignore'), 'utf8');
  assert.ok(after.startsWith(before), 'existing rules and comments survive');
  assert.ok(after.includes('package-lock.json'));

  assert.deepEqual(undoOptimize(cwd), { undone: true, restored: 'previous' });
  assert.equal(fs.readFileSync(path.join(cwd, '.aiignore'), 'utf8'), before);
});

test('undo removes a file the optimize created', () => {
  const cwd = makeRepo({ 'dist/bundle.js': 'x'.repeat(500) });
  const report = scanRepository(cwd);
  optimizeWorkspace(cwd, report);
  assert.equal(fs.existsSync(path.join(cwd, '.aiignore')), true);

  assert.deepEqual(undoOptimize(cwd), { undone: true, restored: 'removed' });
  assert.equal(fs.existsSync(path.join(cwd, '.aiignore')), false);
});

test('undo says so when there is nothing to undo', () => {
  const cwd = makeRepo({ 'a.js': 'x' });
  assert.deepEqual(undoOptimize(cwd), { undone: false, restored: 'none' });
});

test('the guard honours a rule added by optimize immediately', () => {
  const cwd = makeRepo({ 'package-lock.json': 'x'.repeat(4000), 'src/index.js': 'const a=1;\n' });
  optimizeWorkspace(cwd, scanRepository(cwd));
  const rules = fs.readFileSync(path.join(cwd, '.aiignore'), 'utf8').split('\n').filter(Boolean);
  const decision = decideRead({ root: cwd, filePath: 'package-lock.json', rules, level: 1 });
  assert.equal(decision.block, true);
});

test('a session log header names its own directory', async () => {
  const { sessionHeader, activeSession, recentSessions } = await import('../index.js');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-store-'));
  const cwd = makeRepo({ 'a.js': 'x' });
  const other = makeRepo({ 'b.js': 'y' });

  const writeSession = (bucket, id, dir, at) => {
    const sessionDir = path.join(home, 'sessions', bucket, id);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionDir, 'session.v4.jsonl.zstd'),
      zlib.zstdCompressSync(`${JSON.stringify({ type: 'session', version: 4, id, cwd: dir })}\n`)
    );
    fs.utimesSync(path.join(sessionDir, 'session.v4.jsonl.zstd'), at, at);
    return sessionDir;
  };

  const old = writeSession('--old--', 'session-old', other, new Date(Date.now() - 60_000));
  const fresh = writeSession('--new--', 'session-new', cwd, new Date());

  assert.deepEqual(sessionHeader(fresh), { id: 'session-new', cwd });
  assert.equal(sessionHeader(path.join(home, 'nowhere')), null);

  assert.equal(activeSession(home).cwd, cwd, 'the freshest log wins, with its own cwd');
  assert.deepEqual(
    recentSessions(home).map((entry) => [entry.id, entry.cwd]),
    [['session-new', cwd], ['session-old', other]]
  );

  // The point of the header: identity does not depend on the workspace store
  // ever having been told about this session.
  fs.rmSync(path.join(home, 'storages'), { recursive: true, force: true });
  assert.equal(activeSession(home).cwd, cwd);
  assert.equal(old.startsWith(home), true);
});
