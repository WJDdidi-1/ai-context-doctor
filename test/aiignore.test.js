'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { planAiignore, renderAiignore, writeAiignore } = require('../lib/aiignore');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-aiignore-'));
}

test('plans every suggestion when no file exists yet', () => {
  const plan = planAiignore({ existing: null, suggested: ['dist/', 'coverage/', '*.log'] });

  assert.deepEqual(plan.added, ['dist/', 'coverage/', '*.log']);
  assert.equal(plan.created, true);
});

test('appends only the rules that are not already there', () => {
  const existing = '# mine\ndist/\n\ncoverage/  \n';
  const plan = planAiignore({ existing, suggested: ['dist/', 'coverage/', '*.log', '*.log'] });

  assert.deepEqual(plan.added, ['*.log']);
  assert.equal(plan.created, false);
});

test('ignores blank, comment and duplicate suggestions', () => {
  const plan = planAiignore({ existing: null, suggested: ['', '   ', '# comment', 'dist/', 'dist/'] });

  assert.deepEqual(plan.added, ['dist/']);
});

test('keeps the existing file byte for byte and adds one newline before the new rules', () => {
  const existing = 'dist/\n# keep me\n\n';
  const text = renderAiignore({ existing, added: ['*.log'], created: false });

  assert.equal(text, 'dist/\n# keep me\n*.log\n');
});

test('writes a new file with a header', () => {
  const dir = tempDir();
  const target = path.join(dir, '.aiignore');
  const result = writeAiignore(target, ['dist/', '*.log']);

  assert.equal(result.created, true);
  assert.equal(result.written, true);
  assert.match(fs.readFileSync(target, 'utf8'), /^# Files that waste an AI coding agent's context\.\n\n?/);
  assert.match(fs.readFileSync(target, 'utf8'), /dist\/\n\*\.log\n$/);
});

test('running twice leaves the file unchanged', () => {
  const dir = tempDir();
  const target = path.join(dir, '.aiignore');

  writeAiignore(target, ['dist/', '*.log']);
  const first = fs.readFileSync(target, 'utf8');
  const second = writeAiignore(target, ['dist/', '*.log']);

  assert.deepEqual(second.added, []);
  assert.equal(second.written, false);
  assert.equal(fs.readFileSync(target, 'utf8'), first);
});

test('a dry run reports the additions without touching the file system', () => {
  const dir = tempDir();
  const target = path.join(dir, '.aiignore');

  const result = writeAiignore(target, ['dist/'], { dryRun: true });

  assert.deepEqual(result.added, ['dist/']);
  assert.equal(result.written, false);
  assert.equal(fs.existsSync(target), false);
});

test('refuses to write through a symbolic link', () => {
  const dir = tempDir();
  const outside = path.join(dir, 'outside');
  const target = path.join(dir, '.aiignore');

  fs.writeFileSync(outside, 'important\n');
  fs.symlinkSync(outside, target);

  assert.throws(() => writeAiignore(target, ['dist/']), /symbolic link/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'important\n');
});

test('refuses to replace a directory that happens to be called .aiignore', () => {
  const dir = tempDir();
  const target = path.join(dir, '.aiignore');

  fs.mkdirSync(target);

  assert.throws(() => writeAiignore(target, ['dist/']), /not a regular file/);
});
