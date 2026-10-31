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

test('the card shows one score: the current one, whatever the rules are', () => {
  const view = region('ProtectView', 'function SummaryPage');
  assert.match(view, /const firstScore = typeof scored\.healthScore === 'number'/);
  // One number, always the current one. Switching between "before" and "after"
  // depending on whether a folder happened to have rules made two folders
  // answer the same question with different kinds of number.
  assert.match(view, /const shownScore = typeof scored\.effectiveScore === 'number' \? scored\.effectiveScore : firstScore;/);
  assert.match(view, /tr\('scoreCurrentLabel'\)/);
  assert.equal(/scoreBeforeLabel|scoreAfterLabel/.test(view), false, 'no two-state label survives');
});

test('the subline says what is held back, never a before → after pair', () => {
  const view = region('ProtectView', 'function SummaryPage');
  // A folder nobody scanned has no number at all; saying "not scanned yet" is
  // the honest headline. The rest of the line is about what the rules hold
  // back, not about two scores that only ever appear together.
  assert.match(view, /const subline = unscored === true\s*\? tr\('scoreUnknownHint'\)/);
  assert.match(view, /: keptOut > 0/);
  assert.equal(/\$\{firstScore\} → \$\{shownScore\}/.test(view), false, 'the arrow pair is gone');
  assert.match(view, /: tr\('scoreBeforeHint'\)/);
});

test('a folder with no score says so instead of printing a dash', () => {
  const view = region('ProtectView', 'function SummaryPage');
  assert.match(view, /const unscored = shownScore === null;/);
  assert.match(view, /unscored === true\s*\n\s*\? h\('div', \{ className: 'aicd-stat-label aicd-stat-lead' \}, tr\('scoreUnknownLabel'\)\)/);
  assert.equal(/shownScore \?\? '—'/.test(view), false, 'the dash is gone');
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
