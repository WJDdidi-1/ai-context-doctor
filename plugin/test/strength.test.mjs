import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * The strength ladder belongs where its number is.
 *
 * Choosing a notch used to live on Settings while the score it changed lived on
 * Protection: the user had to leave the conversation, change a setting, come
 * back and press refresh to learn what they had just done. These guards keep
 * the ladder on Protection, keep it scored, and keep Settings from growing a
 * second copy of it.
 */
const SOURCE = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8');

function bodyOf(name, nextName) {
  const start = SOURCE.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const end = nextName === undefined ? SOURCE.length : SOURCE.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(end, -1, `${nextName} is missing, cannot bound ${name}`);
  return SOURCE.slice(start, end);
}

test('Protection renders the strength ladder under the score it changes', () => {
  const protect = bodyOf('ProtectView', 'NoWorkspace');
  assert.match(protect, /h\(StrengthStrip, \{ data, level, busy: levelBusy, onPick: onLevel \}\)/,
    'the ladder is on the page with the score');
  const stripAt = protect.indexOf('h(StrengthStrip');
  const hintAt = protect.indexOf("className: 'aicd-hint'");
  assert.ok(stripAt !== -1 && hintAt !== -1 && stripAt < hintAt,
    'the ladder sits above the next-step hint, not buried at the bottom');
});

test('every notch shows the score it would leave', () => {
  const strip = bodyOf('StrengthStrip', 'ProtectView');
  assert.match(strip, /useLevels\(cwd\)/, 'the strip reads the scored ladder');
  assert.match(strip, /effectiveScore/, 'each cell carries a score');
  assert.match(strip, /'aria-pressed': row\.level === level/, 'the chosen notch is announced');
  assert.match(strip, /onClick: \(\) => onPick\(row\.level\)/, 'picking a notch applies it');
});

test('Settings no longer keeps its own copy of the ladder', () => {
  const settings = bodyOf('SettingsView', 'StrengthStrip');
  assert.doesNotMatch(settings, /StrategyCard|LevelsTable|StrengthStrip/,
    'one ladder, in one place');
  assert.match(settings, /strengthMovedGo/, 'and Settings says where it went');
});

test('picking a notch writes the policy and rescores the page', () => {
  const panel = bodyOf('Panel', 'Entry');
  assert.match(panel, /fetch\('\/aiignore\/policy', \{\s*method: 'POST'/, 'the choice is written');
  assert.match(panel, /body: JSON\.stringify\(\{ level: next \}\)/, 'the chosen level is what is written');
  assert.match(panel, /\.then\(\(\) => \{\s*rescan\(\);/, 'and the same folder is read again');
});
