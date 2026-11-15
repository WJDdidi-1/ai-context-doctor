import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * The folder dropdown is chrome, and chrome has one contract: what is open can
 * be closed by Escape, a click outside it, and the button that opened it — and
 * the user's focus must land back on that button. The panel ships as one file
 * with no DOM test harness (real focus needs a browser; the dev/preview page
 * drives it interactively), so this file holds the wiring that makes those
 * three behaviours possible in place. If these assertions fail, the menu has
 * started becoming a trap: something the user can no longer dismiss.
 */
const SOURCE = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8');

test('the folder menu closes on Escape through its key handler', () => {
  const head = SOURCE.slice(SOURCE.indexOf('function PanelHead'), SOURCE.indexOf('#endregion shell'));
  assert.match(head, /onKeyDown: onMenuKey/, 'the menu container handles keys');
  assert.match(head, /event\.key === 'Escape'/, 'Escape is one of the handled keys');
  assert.match(head, /closeMenu\(\)/, 'Escape routes through the shared close');
  assert.match(head, /event\.stopPropagation\(\)/, 'Escape does not also close a host-level surface');
});

test('the folder menu closes on a click outside of it', () => {
  const head = SOURCE.slice(SOURCE.indexOf('function PanelHead'), SOURCE.indexOf('#endregion shell'));
  assert.match(head, /document\.addEventListener\('mousedown', onDocDown\)/, 'outside clicks are watched');
  assert.match(head, /removeEventListener\('mousedown', onDocDown\)/, 'and the watched handler is removed again');
  const listeners = [...head.matchAll(/addEventListener\('mousedown'/g)].length;
  assert.equal(listeners, 1, 'exactly one mousedown owner — no leaked duplicates');
  // The toggle button that opens the menu must not count as outside.
  assert.match(head, /data-aicd-menu-btn/, 'the toggle button carries its own marker');
  assert.match(head, /closest\('\[data-aicd-menu-btn\]'\)/, 'clicking the toggle does not race the listener');
});

test('focus moves in when the menu opens and back to the button on close', () => {
  const head = SOURCE.slice(SOURCE.indexOf('function PanelHead'), SOURCE.indexOf('#endregion shell'));
  assert.match(head, /\.aicd-menu-item:not\(\[aria-disabled="true"\]\)/, 'the first focus target skips disabled items');
  assert.match(head, /first\.focus\(\)/, 'opening focuses into the menu');
  assert.match(head, /menuBtnRef\.current/, 'the toggle button is reachable by ref');
  assert.match(head, /button\.focus\(\)/, 'closing hands focus back to the button');
  assert.match(head, /ArrowDown/, 'arrow keys walk the items, so the menu is keyboard-first');
  assert.match(head, /'aria-haspopup': 'menu'/, 'and the button declares what it opens');
});
