'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { scanRepository, scanLevels } = require('../lib');

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-levels-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'index.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(root, 'README.md'), '# demo\n');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'x'.repeat(64 * 1024));
  fs.writeFileSync(path.join(root, 'package-lock.json'), 'y'.repeat(4096));
  fs.writeFileSync(path.join(root, 'dev.log'), 'z'.repeat(2048));
  return root;
}

test('the five previews match five separate scans', () => {
  const root = makeRepo();
  const rules = ['package-lock.json'];
  const previews = scanLevels(root, { levels: [1, 2, 3, 4, 5], rules });

  for (const preview of previews) {
    const alone = scanRepository(root, { rules, level: preview.level });
    assert.equal(preview.report.effectiveScore, alone.effectiveScore, `level ${preview.level} score`);
    assert.equal(preview.report.blockedFiles, alone.blockedFiles, `level ${preview.level} blocked files`);
    assert.equal(preview.report.allowedBytes, alone.allowedBytes, `level ${preview.level} allowed bytes`);
    assert.deepEqual(preview.report.scoreBreakdown, alone.scoreBreakdown, `level ${preview.level} breakdown`);
    assert.deepEqual(preview.report.suggestedAiignore, alone.suggestedAiignore);
  }
});

test('stronger strengths never let more through', () => {
  const root = makeRepo();
  const previews = scanLevels(root, { levels: [1, 2, 3, 4, 5] });
  const scores = previews.map((preview) => preview.report.effectiveScore);

  for (let index = 1; index < scores.length; index += 1) {
    assert.ok(scores[index] >= scores[index - 1], `level ${index + 1} (${scores[index]}) < level ${index} (${scores[index - 1]})`);
  }
  assert.ok(scores.at(-1) > scores[0], 'the strictest strength has to be visibly better than off');
});

test('a truncating walk truncates every preview, not just the first', () => {
  const root = makeRepo();
  const previews = scanLevels(root, { levels: [1, 3, 5], maxFiles: 2 });

  assert.ok(previews.every((preview) => preview.report.truncated === true));
});

test('an unreadable root gives empty previews instead of throwing', () => {
  const previews = scanLevels(path.join(os.tmpdir(), 'aicd-does-not-exist-levels'), { levels: [1, 3] });

  assert.equal(previews.length, 2);
  for (const preview of previews) {
    assert.equal(preview.report.scannedFiles, 0);
    assert.equal(preview.report.healthScore, 100);
  }
});
