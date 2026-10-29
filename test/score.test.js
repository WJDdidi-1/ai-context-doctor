'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { contextScore, DIMENSIONS, isBinaryPath } = require('../lib/score');

const lostOf = (report, id) => report.breakdown.find((item) => item.id === id).lost;

test('the five dimensions add up to the loss and never exceed their weights', () => {
  const report = contextScore({
    files: 4000,
    bytes: 100 * 1024 * 1024,
    largestBytes: 90 * 1024 * 1024,
    binaryBytes: 90 * 1024 * 1024,
    noise: [{ bytes: 50 * 1024 * 1024, reason: 'large file' }]
  });

  assert.deepEqual(report.breakdown.map((item) => item.id), DIMENSIONS.map((item) => item.id));
  for (const item of report.breakdown) {
    assert.ok(item.lost <= item.weight, `${item.id} never costs more than its weight`);
  }
  const sum = report.breakdown.reduce((total, item) => total + item.lost, 0);
  assert.equal(report.lost, Math.round(sum * 10) / 10);
  assert.equal(report.score, Math.max(0, Math.round(100 - report.lost)));
});

test('an empty or tiny folder scores 100 however lopsided it is', () => {
  assert.equal(contextScore({}).score, 100);
  // One file is always 100% of a one-file folder; that is not "dominating".
  const tiny = contextScore({ files: 1, bytes: 500, largestBytes: 500, binaryBytes: 500 });
  assert.equal(tiny.score, 100);
  assert.equal(lostOf(tiny, 'concentration'), 0);
  assert.equal(lostOf(tiny, 'binary'), 0);
});

test('volume and sprawl cost more as the folder grows, on a log and linear ramp', () => {
  const quarter = contextScore({ files: 100, bytes: 256 * 1024, largestBytes: 1024 });
  const ceiling = contextScore({ files: 100, bytes: 4 * 1024 * 1024, largestBytes: 1024 });
  assert.equal(lostOf(quarter, 'volume'), 0);
  assert.equal(lostOf(ceiling, 'volume'), 25, 'at the ceiling the volume dimension is a full loss');

  const few = contextScore({ files: 300, bytes: 1024, largestBytes: 100 });
  const many = contextScore({ files: 3000, bytes: 1024, largestBytes: 100 });
  assert.equal(lostOf(few, 'sprawl'), 0);
  assert.equal(lostOf(many, 'sprawl'), 15);
});

test('a folder that is mostly one big binary cannot hide behind a clean noise ratio', () => {
  const clean = contextScore({ files: 40, bytes: 8 * 1024 * 1024, largestBytes: 64 * 1024 });
  const dominated = contextScore({ files: 40, bytes: 8 * 1024 * 1024, largestBytes: 7 * 1024 * 1024, binaryBytes: 7 * 1024 * 1024 });
  assert.ok(dominated.score < clean.score - 20, `${dominated.score} should sit well below ${clean.score}`);
  assert.equal(lostOf(dominated, 'concentration'), 20);
  assert.equal(lostOf(dominated, 'binary'), 10);
});

test('isBinaryPath knows the difference between a photo and a script', () => {
  assert.equal(isBinaryPath('assets/logo.PNG'), true);
  assert.equal(isBinaryPath('bin/gh'), false, 'no extension is not evidence of a binary');
  assert.equal(isBinaryPath('src/index.js'), false);
  assert.equal(isBinaryPath('docs/spec.pdf'), true);
});
