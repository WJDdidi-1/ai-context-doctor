'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { scanRepository } = require('../lib/scan');

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-scan-'));
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return root;
}

test('a rule the user wrote leaves the raw score alone but lifts the effective one', () => {
  const root = fixture({
    'dist/bundle.js': 'x'.repeat(4000),
    'src/app.js': 'y'.repeat(400)
  });

  const raw = scanRepository(root);
  const handled = scanRepository(root, { rules: ['dist/'] });

  assert.equal(handled.scannedBytes, raw.scannedBytes, 'nothing is hidden from the count');
  assert.equal(handled.scannedFiles, raw.scannedFiles);
  assert.equal(handled.healthScore, raw.healthScore, 'the folder is still as noisy as it was');
  assert.equal(handled.effectiveScore > raw.effectiveScore, true, 'but less of it reaches the model');
  assert.equal(handled.blockedBytes, 4000);
  assert.equal(handled.blocked[0].path, 'dist/');
});

test('without rules or a strength the effective score equals the raw score', () => {
  const root = fixture({ 'dist/bundle.js': 'x'.repeat(4000), 'src/app.js': 'ok' });
  const report = scanRepository(root);
  assert.equal(report.effectiveScore, report.healthScore);
  assert.equal(report.blockedBytes, 0);
  assert.deepEqual(report.blocked, []);
});

test('the strength decides how much is already handled', () => {
  const root = fixture({
    'dist/bundle.js': 'x'.repeat(4000),
    'package-lock.json': 'l'.repeat(3000),
    'logs/dev.log': 'g'.repeat(2000),
    'src/app.js': 'y'.repeat(400)
  });

  const light = scanRepository(root, { level: 2 });
  const balanced = scanRepository(root, { level: 3 });
  const off = scanRepository(root, { level: 1 });

  assert.equal(off.effectiveScore, off.healthScore, 'off handles nothing');
  assert.equal(balanced.blockedBytes > light.blockedBytes, true, 'a stronger setting handles more');
  assert.equal(balanced.effectiveScore > light.effectiveScore, true);
  assert.equal(light.blockedBytes > 0, true);
});

test('a stronger limit also stops files the classifier would only call large', () => {
  // 1.5 MB is noise at every level (the classifier calls anything over 1 MB
  // large), so the only thing that changes is whether the limit hides it.
  const root = fixture({ 'data/export.json': 'z'.repeat(1536 * 1024), 'src/app.js': 'ok' });

  const light = scanRepository(root, { level: 2 });
  const balanced = scanRepository(root, { level: 3 });

  assert.equal(light.blockedBytes, 0, '1.5 MB is under the light limit');
  assert.equal(balanced.blockedBytes > 0, true, 'and over the balanced one');
  assert.equal(balanced.effectiveScore > light.effectiveScore, true);
});
