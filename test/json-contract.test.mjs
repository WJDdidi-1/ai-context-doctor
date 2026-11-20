import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'ai-context-doctor.js');

// The fields the README documents at the top level of a successful report.
// A rename or removal changes this list and must be treated as a breaking
// change: bump schemaVersion and update the docs, not just this test.
const DOCUMENTED_REPORT_FIELDS = [
  'allowedBytes',
  'allowedFiles',
  'binaryBytes',
  'blocked',
  'blockedBytes',
  'blockedDetails',
  'blockedFiles',
  'blockedReasons',
  'effectiveBreakdown',
  'effectiveLost',
  'effectiveScore',
  'effectiveScoreWithoutRules',
  'healthScore',
  'largestBytes',
  'noisePercent',
  'repo',
  'review',
  'rulesChangeTheScore',
  'scannedBytes',
  'scannedFiles',
  'scoreBreakdown',
  'scoreLost',
  'status',
  'strength',
  'strengthLabel',
  'suggestedAiignore',
  'suggestedRulesChangeTheScore',
  'tokenEstimate',
  'topNoise',
  'usefulPercent'
];

function tempRepo(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-contract-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

function runJson(args) {
  return JSON.parse(execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' }));
}

test('--json success carries schemaVersion 1 and every documented field', (t) => {
  const root = tempRepo({
    'src/index.js': 'const a = 1;\n',
    'package-lock.json': 'x'.repeat(1000),
    'dist/app.js': 'x'.repeat(2000),
    '.env': 'TOKEN=not-a-real-secret\n'
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const report = runJson(['--json', root]);

  assert.equal(report.schemaVersion, 1);
  for (const field of DOCUMENTED_REPORT_FIELDS) {
    assert.ok(
      Object.hasOwn(report, field),
      `--json no longer emits the documented field "${field}"; bump schemaVersion and update README if this rename is intentional`
    );
  }
  // The alias is part of the documented shape, so it must not silently drift.
  assert.deepEqual(report.blockedReasons, report.blockedDetails);
});

test('--json unreadable-directory error carries schemaVersion 1', () => {
  const result = spawnSync(process.execPath, [bin, '--json', './does-not-exist-aicd-contract'], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.error, 'not-a-readable-directory');
  assert.equal(payload.target, './does-not-exist-aicd-contract');
  assert.match(payload.message, /is not a readable directory/);
});

test('--json --explain carries schemaVersion 1 on success and on an unknown path', (t) => {
  const root = tempRepo({
    'src/index.js': 'const a = 1;\n',
    'package-lock.json': 'x'.repeat(1000)
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const explanation = runJson(['--json', '--explain', 'package-lock.json', root]);
  assert.equal(explanation.schemaVersion, 1);
  assert.equal(explanation.found, true);
  assert.equal(explanation.path, 'package-lock.json');

  const missing = spawnSync(process.execPath, [bin, '--json', '--explain', 'nope.js', root], {
    encoding: 'utf8'
  });
  assert.equal(missing.status, 2);
  const payload = JSON.parse(missing.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.error, 'unknown-path');
  assert.equal(payload.path, 'nope.js');
});

test('--json --write carries schemaVersion 1 on success and on a write error', (t) => {
  const root = tempRepo({ 'package-lock.json': 'x'.repeat(1000) });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const written = runJson(['--json', '--write', root]);
  assert.equal(written.schemaVersion, 1);
  assert.equal(written.write.written, true);

  // A directory named `.aiignore` is refused by the writer, so this exercises
  // the error payload rather than a permission-dependent failure.
  const blockedRoot = tempRepo({ 'package-lock.json': 'x'.repeat(1000) });
  fs.mkdirSync(path.join(blockedRoot, '.aiignore'));
  t.after(() => fs.rmSync(blockedRoot, { recursive: true, force: true }));

  const failed = spawnSync(process.execPath, [bin, '--json', '--write', blockedRoot], {
    encoding: 'utf8'
  });
  assert.equal(failed.status, 1);
  const payload = JSON.parse(failed.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.error, 'not-a-file');
});
