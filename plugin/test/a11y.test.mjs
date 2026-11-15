// Keyboard and screen-reader contract of the panel. Source guards: the panel
// has no DOM in this test environment, so these assert the markup the panel
// builds. The behaviour itself is exercised in dev/preview.html.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');

test('the tablist can be driven from the keyboard', () => {
  assert.match(source, /role: 'tablist'/);
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
    assert.ok(source.includes(`event.key === '${key}'`), `tablist must handle ${key}`);
  }
  // One stop for the whole tablist, and the stop follows the selection.
  assert.match(source, /tabIndex: view === id \? 0 : -1/);
  assert.match(source, /'aria-selected': view === id \? 'true' : 'false'/);
});

test('each view is a tabpanel named by the tab that opened it', () => {
  assert.match(source, /role: 'tabpanel'/);
  assert.match(source, /id: `aicd-view-\$\{view\}`/);
  assert.match(source, /'aria-labelledby': `aicd-tab-\$\{view\}`/);
  assert.match(source, /'aria-controls': `aicd-view-\$\{id\}`/);
});

test('icon-only buttons carry a name', () => {
  const buttons = source.split("className: 'aicd-iconbtn'").slice(1);
  assert.ok(buttons.length >= 3, 'expected the refresh, folder and close buttons');
  for (const chunk of buttons) {
    const head = chunk.slice(0, 240);
    assert.ok(head.includes("'aria-label'"), 'an icon-only button needs an aria-label');
  }
});

test('status changes are announced', () => {
  assert.match(source, /className: 'aicd-toast', role: 'status'/);
  assert.match(source, /className: 'aicd-steps', 'aria-live': 'polite'/);
});
