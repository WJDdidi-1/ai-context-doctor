import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { listDirectory, resolveDirectory } from '../tree.js';
import { createWorkspaceState, recordSkip, recordRead } from '../report.js';

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-tree-'));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'x'.repeat(4000));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(root, '.env.example'), 'A=1\n');
  return root;
}

test('a directory request cannot step outside the workspace', () => {
  const root = workspace();
  assert.equal(resolveDirectory(root, '..'), null);
  assert.equal(resolveDirectory(root, '../../etc'), null);
  assert.equal(resolveDirectory(root, '/etc').relative, 'etc');
  assert.equal(resolveDirectory(root, 'src/').relative, 'src');
  assert.equal(listDirectory({ root, dir: '..' }).error, 'outside-workspace');
});

test('folders come first, then files by size, each with the scanner verdict', () => {
  const root = workspace();
  const listing = listDirectory({ root });

  assert.equal(listing.dir, '');
  assert.equal(listing.parent, null);
  const names = listing.entries.map((entry) => entry.name);
  assert.deepEqual(names.slice(0, 2), ['dist', 'src']);

  const lock = listing.entries.find((entry) => entry.name === 'package-lock.json');
  assert.equal(lock.badge, 'noise');
  assert.equal(lock.reason, 'lockfile');

  const template = listing.entries.find((entry) => entry.name === '.env.example');
  assert.equal(template.badge, 'review');

  const folder = listing.entries.find((entry) => entry.name === 'dist');
  assert.equal(folder.type, 'dir');
  assert.equal(folder.badge, 'noise', 'a noise folder is marked as one without opening it');

  const inner = listDirectory({ root, dir: 'src' });
  assert.equal(inner.dir, 'src');
  assert.equal(inner.parent, '');
  assert.deepEqual(inner.entries.map((entry) => entry.name), ['app.js']);
});

test('the tree reflects what the guard already did in this session', () => {
  const root = workspace();
  const state = createWorkspaceState();
  recordSkip(state, { relativePath: 'dist/bundle.js', bytes: 4000, reason: 'generated build output' });
  recordRead(state, { relativePath: 'src/app.js', bytes: 21, verdict: 'useful' });

  const dist = listDirectory({ root, dir: 'dist', state }).entries[0];
  assert.equal(dist.blocked, true);
  assert.equal(dist.tries, 1);

  const src = listDirectory({ root, dir: 'src', state }).entries[0];
  assert.equal(src.read, true);
});

test('a .aiignore rule marks a file the heuristic would have passed', () => {
  const root = workspace();
  const rules = ['src/app.js'];
  const src = listDirectory({ root, dir: 'src', rules }).entries[0];
  assert.equal(src.ignored, true);
});
