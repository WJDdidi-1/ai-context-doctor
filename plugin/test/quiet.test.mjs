// The counter has a state the other tests do not reach: a conversation that
// read nothing worth holding back. It used to print "0" with the label of a
// result, which reads as a broken counter rather than as good news.
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

test('the empty state says what was read instead of printing a zero', () => {
  const view = region('ProtectView', 'function SummaryPage');
  assert.match(view, /const quiet = keptOut === 0 && pendingReads === 0;/);
  assert.match(view, /quiet === true\s*\? h\(QuietCard, \{ conversation \}\)/);
  // No branch may fall through to a numeric zero any more.
  assert.equal(/value: 0,/.test(view), false, 'no zero headline');
  assert.equal(view.includes("'heroMany'"), true, 'the plural label still exists for real counts');
});

test('the quiet card names the files and the tokens', () => {
  const card = region('QuietCard', 'function ProtectView');
  assert.match(card, /conversation\.readFiles/);
  assert.match(card, /formatTokensCompact\(conversation\.tokens\)/);
  assert.match(card, /fill\(tr\(known \? 'heroQuietLine' : 'heroQuietLineShort'\)/);
});

test('nothing to write means no button that writes nothing', () => {
  const view = region('ProtectView', 'function SummaryPage');
  assert.match(view, /quiet === true \? null : h\('button', \{/);
});

test('the fill helper leaves unknown slots alone', () => {
  const helpers = region('fill', 'function formatBytes');
  assert.match(helpers, /hasOwnProperty\.call\(values, name\)/);
});
