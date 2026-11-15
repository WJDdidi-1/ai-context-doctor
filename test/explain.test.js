'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { explainPath } = require('../lib');

const bin = path.join(__dirname, '..', 'bin', 'ai-context-doctor.js');

function tempRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-explain-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

function explain(root, target) {
  return spawnSync(process.execPath, [bin, '--explain', target, root], { encoding: 'utf8' });
}

test('--explain names the strength, category and score impact of a blocked file', () => {
  const root = tempRepo({
    'src/index.js': 'const a = 1;\n',
    'package-lock.json': 'x'.repeat(1000)
  });
  const result = explain(root, 'package-lock.json');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Verdict: blocked/);
  assert.match(result.stdout, /Rule: strength 3 \(Balanced\) skips lockfiles/);
  assert.match(result.stdout, /Category: lockfile/);
  assert.match(result.stdout, /Score impact: allowing it would cost \d/);
});

test('--explain names the exact .aiignore rule when one decided the verdict', () => {
  const root = tempRepo({
    'src/index.js': 'const a = 1;\n',
    '.aiignore': 'src/index.js\n'
  });
  const result = explain(root, 'src/index.js');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Verdict: blocked/);
  assert.match(result.stdout, /Rule: \.aiignore rule "src\/index\.js"/);
  assert.match(result.stdout, /Category: none \(not context noise\)/);
  assert.match(result.stdout, /Score impact:/);
});

test('--explain says an unblocked path is not blocked', () => {
  const root = tempRepo({ 'src/index.js': 'const a = 1;\n' });
  const result = explain(root, 'src/index.js');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Verdict: not blocked/);
  assert.match(result.stdout, /Rule: none/);
  assert.match(result.stdout, /Score impact: none/);
});

test('--explain exits 2 with a clear message for a path the scan never saw', () => {
  const root = tempRepo({ 'src/index.js': 'const a = 1;\n' });
  const result = explain(root, 'src/missing.js');

  assert.equal(result.status, 2);
  assert.match(result.stderr, /src\/missing\.js is not a file in the scanned directory/);
  assert.match(result.stderr, /Pass a path relative to that directory/);
});

test('explainPath returns the same decision as structured data', () => {
  const root = tempRepo({
    'src/index.js': 'const a = 1;\n',
    'package-lock.json': 'x'.repeat(1000)
  });
  const explanation = explainPath(root, 'package-lock.json', { level: 3 });

  assert.equal(explanation.found, true);
  assert.equal(explanation.verdict, 'blocked');
  assert.equal(explanation.category, 'lockfile');
  assert.equal(explanation.rule.source, 'strength');
  assert.match(explanation.rule.description, /skips lockfiles/);
  assert.ok(explanation.scoreImpact.points > 0);
  assert.equal(
    explanation.scoreImpact.effectiveScoreIfAllowed,
    explanation.scoreImpact.effectiveScore - explanation.scoreImpact.points
  );
});

test('--json --explain returns the explanation as an object', () => {
  const root = tempRepo({ 'src/index.js': 'const a = 1;\n', 'package-lock.json': 'x'.repeat(1000) });
  const result = spawnSync(process.execPath, [bin, '--json', '--explain', 'package-lock.json', root], {
    encoding: 'utf8'
  });
  const explanation = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(explanation.found, true);
  assert.equal(explanation.verdict, 'blocked');
  assert.equal(explanation.category, 'lockfile');
});
