import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Every component a view renders has to exist.
 *
 * Deleting a render function while its call site stays behind is invisible to
 * every test that loads the module (it only throws when that branch renders)
 * and to `node --check` (it is valid syntax, just a missing name). That is how
 * `RulesCard` slipped out of `SettingsView` once: the page rendered nothing on
 * the Settings tab and no test said a word.
 */
const SOURCE = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8');

test('every component rendered is defined somewhere in the bundle', () => {
  const used = new Set();
  const pattern = /\bh\(([A-Z][A-Za-z0-9_]*)\s*[,)]/g;
  let match = pattern.exec(SOURCE);
  while (match !== null) {
    used.add(match[1]);
    match = pattern.exec(SOURCE);
  }
  assert.ok(used.size > 5, 'the scan found components to check');

  const missing = [...used].filter((name) => {
    const declared = SOURCE.includes(`function ${name}(`) || SOURCE.includes(`const ${name} =`);
    return declared === false;
  });
  assert.deepEqual(missing, [], `rendered but never defined: ${missing.join(', ')}`);
});
