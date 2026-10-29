'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanRepository } = require('../lib/scan');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-test-'));
  for (const [name, size] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.alloc(size, 'x'));
  }
  return root;
}

test('counts files and bytes, ignoring vendored directories', () => {
  const root = makeRepo({
    'src/index.js': 100,
    'node_modules/pkg/index.js': 500,
    '.git/config': 10
  });

  const report = scanRepository(root);

  assert.equal(report.scannedFiles, 1);
  assert.equal(report.scannedBytes, 100);
  assert.deepEqual(report.topNoise, []);
  assert.equal(report.healthScore, 100);
});

test('treats lockfiles, logs, and build output as noise', () => {
  const root = makeRepo({
    'src/index.js': 100,
    'package-lock.json': 100,
    'logs/dev.log': 100,
    'dist/bundle.js': 100
  });

  const report = scanRepository(root);

  assert.equal(report.scannedFiles, 4);
  assert.equal(report.scannedBytes, 400);
  // Three quarters of the bytes are noise, weighted by severity: build 0.25x1.0,
  // lockfile 0.25x0.8, log 0.25x0.8 = 0.65 of the 30-point noise dimension.
  assert.equal(report.healthScore, 81);
  assert.equal(report.scoreLost, 19.5);
  assert.deepEqual(
    report.scoreBreakdown.map((item) => [item.id, item.lost]),
    [['noise', 19.5], ['volume', 0], ['concentration', 0], ['sprawl', 0], ['binary', 0]]
  );
  assert.equal(report.noisePercent, 75);
  assert.deepEqual(
    [...report.topNoise.map((item) => item.reason)].sort(),
    ['generated build output', 'local log file', 'lockfile']
  );
  assert.deepEqual([...report.suggestedAiignore].sort(), ['*.log', 'dist/', 'package-lock.json'].sort());
});

test('suggests .env* but does not treat templates as noise', () => {
  const root = makeRepo({
    'src/index.js': 100,
    '.env': 100,
    '.env.example': 100
  });

  const report = scanRepository(root);

  assert.equal(report.healthScore, 100);
  assert.deepEqual(report.suggestedAiignore, ['.env*']);
  assert.equal(report.review.length, 2);
  assert.match(report.review.find((item) => item.path === '.env.example').reason, /template/);
});

test('flags files above 1 MiB as large', () => {
  const root = makeRepo({
    'src/index.js': 100,
    'assets/big.bin': 1024 * 1024 + 1
  });

  const report = scanRepository(root);

  assert.equal(report.topNoise.length, 1);
  assert.equal(report.topNoise[0].reason, 'large file');
});

test('marks the report truncated when a cap is hit', () => {
  const root = makeRepo({
    'a.js': 10,
    'b.js': 10,
    'c.js': 10
  });

  const report = scanRepository(root, { maxFiles: 2 });

  assert.equal(report.truncated, true);
  assert.equal(report.scannedFiles, 2);
});

test('uses the directory name as the repo label', () => {
  const root = makeRepo({ 'a.js': 10 });
  assert.equal(scanRepository(root).repo, path.basename(root));
});

test('reports a token range instead of one invented number', () => {
  const root = makeRepo({ 'a.js': 4320, 'dist/b.js': 3080 });

  const report = scanRepository(root);

  // 3.08–4.32 bytes per token is the measured range in docs/research.
  assert.deepEqual(report.tokenEstimate, {
    noise: { min: 713, max: 1000 },
    useful: { min: 1000, max: 1403 }
  });
});

test('classifyPath is exported so the plugin blocks the same files the report flags', () => {
  const { classifyPath } = require('../lib');

  assert.deepEqual(classifyPath('dist/app.js', 10), {
    noise: { label: 'dist/', reason: 'generated build output' },
    suggestion: 'dist/'
  });
  assert.deepEqual(classifyPath('package-lock.json', 10).suggestion, 'package-lock.json');
  assert.deepEqual(classifyPath('.env.example', 10), {
    review: { label: '.env.example', reason: 'environment template (usually safe to share)' },
    suggestion: null
  });
  assert.deepEqual(classifyPath('src/app.js', 10), { suggestion: null });
});
