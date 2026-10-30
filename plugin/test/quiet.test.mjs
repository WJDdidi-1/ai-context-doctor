// The first screen used to be a counter of guard refusals: a number that stays
// 0 until something is actually blocked, and a button that vanished when there
// was nothing to write. Opening the panel and finding no action at all is what
// the user reported, so the card now leads with a score and always offers the
// button — the interaction is: look, press, watch the score move.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const CLIENT = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8');

function region(name, stop) {
  const start = CLIENT.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  return CLIENT.slice(start, CLIENT.indexOf(stop, start));
}

test('the card opens on the score the folder has before any rule', () => {
  const view = region('ProtectView', 'function SummaryPage');
  assert.match(view, /const firstScore = typeof scored\.healthScore === 'number'/);
  // Rules, not the arithmetic, decide which score is on screen: a first open
  // must show the folder as it is, or the press it invites has already happened.
  assert.match(view, /const applied = rules\.length > 0 && typeof scored\.effectiveScore === 'number';/);
  assert.match(view, /const shownScore = applied === true \? scored\.effectiveScore : firstScore;/);
  assert.match(view, /tr\(applied === true \? 'scoreAfterLabel' : 'scoreBeforeLabel'\)/);
});

test('the score card says what moved after Optimize', () => {
  const view = region('ProtectView', 'function SummaryPage');
  assert.match(view, /const subline = applied === true\s*\? `\$\{firstScore\} → \$\{shownScore\}/);
  assert.match(view, /: tr\('scoreBeforeHint'\)/);
});

test('the button is always there, even when nothing is worth writing', () => {
  const view = region('ProtectView', 'function SummaryPage');
  assert.equal(/quiet === true \? null : h\('button'/.test(view), false, 'the button is not hidden any more');
  assert.match(view, /disabled: progress !== null,\s*\n\s*onClick: optimize/);
});

test('a quiet conversation says what it read instead of a bare zero', () => {
  const view = region('ProtectView', 'function SummaryPage');
  assert.match(view, /fill\(tr\(tokens === '—' \? 'heroQuietLineShort' : 'heroQuietLine'\), \{ files, tokens \}\)/);
  assert.equal(/value: 0,/.test(view), false, 'no zero headline');
});

test('the fill helper leaves unknown slots alone', () => {
  const helpers = region('fill', 'function formatBytes');
  assert.match(helpers, /hasOwnProperty\.call\(values, name\)/);
});
