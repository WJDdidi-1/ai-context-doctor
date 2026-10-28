import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * The browser half ships as one file: the harness loads it through
 * `window.__ModuleLoader__.load({ factory })`, which has no module resolution
 * and there is no build step. Regions are how it stays readable — and this
 * test is what keeps them from rotting into a 2000-line pile.
 */
const CLIENT = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8');

const EXPECTED = ['copy', 'styles', 'helpers', 'components', 'views', 'shell', 'registration'];

test('client.js declares its regions once, in reading order', () => {
  const opened = [...CLIENT.matchAll(/\/\/#region (\S+)/g)].map((match) => match[1]);
  const closed = [...CLIENT.matchAll(/\/\/#endregion (\S+)/g)].map((match) => match[1]);

  assert.deepEqual(opened, EXPECTED);
  assert.deepEqual(closed, EXPECTED, 'every region closes, in the same order');
});

test('each region holds a bounded amount of code', () => {
  const bounds = { copy: 220, styles: 800, helpers: 240, components: 200, views: 520, shell: 260, registration: 90 };
  const lines = CLIENT.split('\n');
  let open = null;
  let start = 0;
  for (const [index, line] of lines.entries()) {
    const opened = line.match(/\/\/#region (\S+)/);
    if (opened !== null) {
      open = opened[1];
      start = index;
      continue;
    }
    const closed = line.match(/\/\/#endregion (\S+)/);
    if (closed !== null) {
      const size = index - start;
      assert.ok(size <= bounds[open], `region ${open} grew to ${size} lines (limit ${bounds[open]})`);
      open = null;
    }
  }
  assert.equal(open, null, 'the last region closes');
});
