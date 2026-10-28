import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { removeAiignoreRule } from '../index.js';

function workspace(text) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-undo-'));
  if (text !== null) fs.writeFileSync(path.join(root, '.aiignore'), text);
  return root;
}

test('one rule comes back out, and every other line survives byte for byte', () => {
  const root = workspace('# my rules\ndist/\nlogs/dev.log\npackage-lock.json\n');
  assert.deepEqual(removeAiignoreRule(root, 'logs/dev.log'), { removed: true });
  assert.equal(fs.readFileSync(path.join(root, '.aiignore'), 'utf8'), '# my rules\ndist/\npackage-lock.json\n');
});

test('removing a rule that is not there changes nothing', () => {
  const original = 'dist/\n';
  const root = workspace(original);
  assert.deepEqual(removeAiignoreRule(root, 'logs/dev.log'), { removed: false });
  assert.equal(fs.readFileSync(path.join(root, '.aiignore'), 'utf8'), original);
});

test('a missing file, a symlink and a directory are all refused', () => {
  assert.deepEqual(removeAiignoreRule(workspace(null), 'dist/'), { removed: false });

  const linkRoot = workspace('dist/\n');
  const target = path.join(linkRoot, '.aiignore');
  const real = path.join(linkRoot, 'real.aiignore');
  fs.renameSync(target, real);
  fs.symlinkSync(real, target);
  assert.deepEqual(removeAiignoreRule(linkRoot, 'dist/'), { removed: false });
  assert.equal(fs.readFileSync(real, 'utf8'), 'dist/\n');

  const dirRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-undo-'));
  fs.mkdirSync(path.join(dirRoot, '.aiignore'));
  assert.deepEqual(removeAiignoreRule(dirRoot, 'dist/'), { removed: false });
});

test('removing the last rule leaves an empty file, not a stray newline', () => {
  const root = workspace('dist/\n');
  assert.deepEqual(removeAiignoreRule(root, 'dist/'), { removed: true });
  assert.equal(fs.readFileSync(path.join(root, '.aiignore'), 'utf8'), '');
});
