// Optimize is one request on the Host side, so the panel may only claim the
// steps it can verify. These are source guards: the panel has no DOM in the test
// environment, and the interaction itself is checked in dev/preview.html.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');

const between = (start, end) => {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing anchor: ${start}`);
  const to = source.indexOf(end, from);
  assert.notEqual(to, -1, `missing anchor: ${end}`);
  return source.slice(from, to);
};

test('optimize reports the two steps it really performs', () => {
  assert.match(source, /const PHASES = \['Scan', 'Write'\]/);
  const view = between('function ProtectView', 'function SummaryPage');
  assert.match(view, /className: 'aicd-steps'/);
  assert.match(view, /data-state': done === true \? 'done' : active === true \? 'active' : 'todo'/);
});

test('no percentage is invented for a request the host answers in one go', () => {
  assert.equal(source.includes('aicd-progress'), false, 'the fake bar must be gone');
  assert.equal(source.includes('aria-valuenow'), false);
  const script = between('const optimizeNow = () => {', '// Applying a notch is a write');
  assert.equal(script.includes("'/aiignore/scan"), false, 'optimize must not pre-scan: the host already reads twice');
  assert.equal(script.match(/fetch\('\/aiignore\/optimize'/g).length, 1);
});

test('a finished optimize refreshes what the page shows', () => {
  const script = between('const optimizeNow = () => {', '// Applying a notch is a write');
  for (const call of ['applyReport(payload.report)', 'reload()', 'reloadTree()', 'refreshConversation()']) {
    assert.ok(script.includes(call), `optimize must call ${call}`);
  }
});
