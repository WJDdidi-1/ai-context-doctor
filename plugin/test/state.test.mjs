import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Three surfaces load on their own, and each used to answer "still loading",
 * "empty" and "failed" differently: the strength table disappeared while it
 * loaded and stayed gone when it failed, the left page was blank until data
 * arrived and then blamed the server for any status, and a conversation that
 * could not be read looked exactly like a conversation that read nothing.
 *
 * These guards hold the shared answer in place without a DOM harness: one
 * `State` renderer, a reason that is the real one, and a retry wherever a
 * failure is shown.
 */
const SOURCE = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8');

/** The body of one top-level function, from its declaration to the next one. */
function bodyOf(name, nextName) {
  const start = SOURCE.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const end = SOURCE.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(end, -1, `${nextName} is missing, cannot bound ${name}`);
  return SOURCE.slice(start, end);
}

test('the shared state renderer has all three kinds and names its reason', () => {
  const state = bodyOf('State', 'useReport');
  assert.match(state, /kind === 'loading'/, 'loading renders the skeleton');
  assert.match(state, /'aria-busy': 'true'/, 'loading is announced as busy');
  assert.match(state, /const failed = kind === 'error'/, 'failure has its own branch');
  assert.match(state, /reasonOf\(error\)/, 'a failure prints the real reason');
  assert.match(state, /onRetry/, 'a failure offers the way back');
});

test('a reason is the status, not a guess about the setup', () => {
  const reason = bodyOf('reasonOf', 'State');
  assert.match(reason, /error\.message/, 'the message is the source');
  assert.match(reason, /return message;/, 'and it is what gets shown');
  assert.doesNotMatch(reason, /permission|writ/i, 'no invented cause');
});

test('the strength ladder never disappears while loading or after a failure', () => {
  const strip = bodyOf('StrengthStrip', 'ProtectView');
  assert.match(strip, /kind: 'loading'/, 'loading shows the skeleton');
  assert.match(strip, /kind: 'error'/, 'a failure is shown, not swallowed');
  assert.match(strip, /strengthFailed/, 'the failure explains what it means for the user');
  assert.match(strip, /onRetry: retry/, 'the failure can be retried');
  const hook = bodyOf('useLevels', 'State');
  assert.doesNotMatch(
    hook,
    /catch\(\(\) => \{\s*if \(live === true\) setLevels\(\[\]\);/,
    'a failed read must not masquerade as "no levels"'
  );
});

test('the left page says it is loading instead of rendering blank', () => {
  const summary = SOURCE.slice(SOURCE.indexOf('function SummaryPage('), SOURCE.indexOf('function formatBurn'));
  assert.match(summary, /kind: 'loading'/, 'loading has a state');
  assert.match(summary, /kind: 'error', errorTitle: tr\('overviewFailedTitle'\), hint: tr\('overviewFailed'\)/, 'failure explains itself in context');
  assert.match(summary, /error: failed, onRetry/, 'failure is retryable');
  assert.doesNotMatch(summary, /tr\('errorHint'\)/, 'no generic "cannot reach the server" for any status');
});

test('a conversation that could not be read is said out loud on Protection', () => {
  const protect = bodyOf('ProtectView', 'NoWorkspace');
  assert.match(protect, /convError/, 'the failure reaches the page');
  assert.match(protect, /chatUnavailable/, 'and it is named');
  assert.match(protect, /reasonOf\(convError\)/, 'with the real reason');
});
