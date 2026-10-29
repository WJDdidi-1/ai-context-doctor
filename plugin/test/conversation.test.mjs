import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// These tests read the session projection, never the developer's own store.
process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-conv-home-'));

const { projectionPath, readProjection, conversationReport } = await import('../index.js');

const SESSION = 'session-11111111-2222-3333-4444-555555555555';

function makeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-conv-'));
  const workspace = path.join(home, 'work');
  fs.mkdirSync(workspace, { recursive: true });
  return { home, workspace };
}

function writeProjection(home, id, { cwd, title, fileOps, sums }) {
  const target = path.join(home, 'storages', 'session_projcache', 'sessions', `${id}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({
    version: 1,
    record: {
      identity: { formatVersion: 4, createdAt: 0, cwd },
      rows: {
        title: { ver: 1, seq: 1, val: title },
        sessionStats: { ver: 1, seq: 1, val: { turns: 4, steps: 9 } },
        contextBreakdown: { ver: 6, seq: 1, val: { surfaceTokens: 1234 } },
        contextTimeline: {
          ver: 31,
          seq: 1,
          val: {
            sums: sums || { user: 10, inject: 20, skill: 0, assistant: 100, tool: 200 },
            systemTokens: 50,
            toolsTokens: 60,
            contextWindow: 1000000,
            fileOps
          }
        }
      }
    }
  }));
}

test('a projection is found by session id, and only for a plausible id', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-proj-'));
  assert.equal(projectionPath('../../etc/passwd', home), null);
  assert.equal(projectionPath('session-', home), null);
  assert.equal(projectionPath(42, home), null);
  assert.equal(projectionPath(SESSION, home), path.join(home, 'storages', 'session_projcache', 'sessions', `${SESSION}.json`));
});

test('the projection yields the conversation title, folder and token split', () => {
  const { home, workspace } = makeHome();
  writeProjection(home, SESSION, { cwd: workspace, title: 'Fix the parser', fileOps: [] });

  const projection = readProjection(SESSION, home);
  assert.equal(projection.title, 'Fix the parser');
  assert.equal(projection.cwd, workspace);
  assert.equal(projection.turns, 4);
  assert.deepEqual(projection.sums, { user: 10, inject: 20, skill: 0, assistant: 100, tool: 200 });
  assert.equal(readProjection('session-deadbeef-0000-0000-0000-000000000000', home), null);
});

test('a conversation that only read source files scores 100', () => {
  const { home, workspace } = makeHome();
  fs.writeFileSync(path.join(workspace, 'app.js'), 'console.log(1)\n');
  fs.writeFileSync(path.join(workspace, 'readme.md'), '# hi\n');
  writeProjection(home, SESSION, {
    cwd: workspace,
    title: 'Read some source',
    fileOps: [
      { seq: 1, kind: 'read', tool: 'read', err: false, added: 0, removed: 0, path: path.join(workspace, 'app.js'), time: 10 },
      { seq: 2, kind: 'read', tool: 'read', err: false, added: 0, removed: 0, path: path.join(workspace, 'readme.md'), time: 20 }
    ]
  });

  const report = conversationReport(SESSION, { home });
  assert.equal(report.score, 100);
  assert.equal(report.readFiles, 2);
  assert.equal(report.noiseBytes, 0);
  assert.deepEqual(report.noise, []);
  assert.deepEqual(report.suggestedAiignore, []);
});

test('noise reads are named, cost score, and become the suggested rules', () => {
  const { home, workspace } = makeHome();
  fs.mkdirSync(path.join(workspace, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'dist', 'bundle.js'), 'x'.repeat(4000));
  fs.writeFileSync(path.join(workspace, 'app.js'), 'y'.repeat(400));
  writeProjection(home, SESSION, {
    cwd: workspace,
    title: 'Wandered into dist',
    fileOps: [
      { seq: 1, kind: 'read', tool: 'read', err: false, added: 0, removed: 0, path: path.join(workspace, 'dist', 'bundle.js'), time: 10 },
      { seq: 2, kind: 'read', tool: 'read', err: false, added: 0, removed: 0, path: path.join(workspace, 'app.js'), time: 20 }
    ]
  });

  const report = conversationReport(SESSION, { home });
  assert.equal(report.score < 100, true, 'a noisy read has to cost something');
  assert.equal(report.noise.length, 1);
  assert.equal(report.noise[0].relativePath, 'dist/bundle.js');
  assert.equal(report.noise[0].path, 'dist/bundle.js');
  assert.equal(report.noiseBytes, 4000);
  assert.deepEqual(report.suggestedAiignore, ['dist/']);
});

test('what a rule keeps out is scored separately from what the conversation read', () => {
  const { home, workspace } = makeHome();
  fs.mkdirSync(path.join(workspace, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'dist', 'bundle.js'), 'x'.repeat(4000));
  writeProjection(home, SESSION, {
    cwd: workspace,
    title: 'Wandered into dist',
    fileOps: [
      { seq: 1, kind: 'read', tool: 'read', err: false, added: 0, removed: 0, path: path.join(workspace, 'dist', 'bundle.js'), time: 10 }
    ]
  });

  // Strength off: nothing would be stopped, so both numbers agree.
  fs.writeFileSync(path.join(workspace, '.aiignore.policy.json'), JSON.stringify({ level: 1, key: 'off' }));
  const off = conversationReport(SESSION, { home });
  assert.equal(off.effectiveScore, off.score, 'with the guard off, what was read is what gets through');
  assert.equal(off.covered.length, 0);

  // A rule written afterwards cannot change history — but it changes this number,
  // which is the one Optimize is supposed to move.
  fs.writeFileSync(path.join(workspace, '.aiignore'), 'dist/\n');
  const after = conversationReport(SESSION, { home });
  assert.equal(after.score, off.score, 'the reads already happened');
  assert.equal(after.effectiveScore, 100);
  assert.equal(after.coveredBytes, 4000);
  assert.deepEqual(after.covered.map((entry) => entry.path), ['dist/bundle.js']);
  assert.equal(after.covered[0].reason, 'listed in .aiignore');
});

test('reads outside the folder are counted but never treated as project noise', () => {
  const { home, workspace } = makeHome();
  const outside = path.join(home, 'elsewhere', 'notes.log');
  fs.mkdirSync(path.dirname(outside), { recursive: true });
  fs.writeFileSync(outside, 'z'.repeat(500));
  writeProjection(home, SESSION, {
    cwd: workspace,
    title: 'Read something outside',
    fileOps: [
      { seq: 1, kind: 'read', tool: 'read', err: false, added: 0, removed: 0, path: outside, time: 10 }
    ]
  });

  const report = conversationReport(SESSION, { home });
  assert.equal(report.readFiles, 1);
  assert.equal(report.noise.length, 0, 'a path outside the workspace has no relative rule to suggest');
});
