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

const EXPECTED = ['copy', 'styles', 'helpers', 'components', 'views', 'chat', 'summary', 'shell', 'registration'];

test('client.js declares its regions once, in reading order', () => {
  const opened = [...CLIENT.matchAll(/\/\/#region (\S+)/g)].map((match) => match[1]);
  const closed = [...CLIENT.matchAll(/\/\/#endregion (\S+)/g)].map((match) => match[1]);

  assert.deepEqual(opened, EXPECTED);
  assert.deepEqual(closed, EXPECTED, 'every region closes, in the same order');
});

test('each region holds a bounded amount of code', () => {
  // Bound per region, not per file: copy grows with every control (two
  // languages) and views grows with every page, but a region that doubles
  // without a new page is drift.
  // `styles` is one region by design: the CSS is inlined verbatim, and a second
// copy of it is a bug waiting to happen. It grows when the UI grows.
const bounds = { copy: 360, styles: 1400, helpers: 280, components: 200, views: 640, chat: 200, summary: 160, shell: 340, registration: 120 };
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
