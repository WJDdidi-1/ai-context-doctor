import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const here = new URL('.', import.meta.url);
const clientSource = fs.readFileSync(new URL('../client.js', here), 'utf8');
const panelCss = fs.readFileSync(new URL('../ui/panel.css', here), 'utf8');

/** The stylesheet as client.js ships it: the raw text between the template ticks. */
function inlinedCss() {
  const marker = 'const CSS = String.raw`';
  const start = clientSource.indexOf(marker);
  assert.notEqual(start, -1, 'client.js no longer embeds a stylesheet');
  const from = start + marker.length;
  const end = clientSource.indexOf('`;', from);
  assert.notEqual(end, -1, 'the embedded stylesheet is not terminated');
  return clientSource.slice(from, end);
}

test('the embedded stylesheet is ui/panel.css, byte for byte', () => {
  assert.equal(inlinedCss(), panelCss);
});

test('the stylesheet stays safe to embed in a template literal', () => {
  assert.equal(panelCss.includes('`'), false, 'a backtick would end the template early');
  assert.equal(panelCss.includes('${'), false, 'an interpolation would be evaluated at load');
});

test('every custom property has a fallback, so an unknown host still renders', () => {
  const bare = [...panelCss.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]);
  assert.deepEqual(bare, [], `these need a fallback: ${bare.join(', ')}`);
});

test('every class the panel sets exists in the stylesheet', () => {
  const used = new Set();
  for (const match of clientSource.matchAll(/className: '([^']+)'/g)) {
    for (const name of match[1].split(/\s+/)) if (name.startsWith('aicd-')) used.add(name);
  }
  const missing = [...used].filter((name) => !panelCss.includes(`.${name}`));
  assert.deepEqual(missing, [], `used but never styled: ${missing.join(', ')}`);
});
