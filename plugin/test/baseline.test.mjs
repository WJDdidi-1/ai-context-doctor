// The visual baselines are the only record of what the panel should look like,
// so they are checked the way code is: present, complete, and not quietly
// edited. Re-capturing is a deliberate act, documented in plugin/README.md.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'assets', 'baseline');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
const README = fs.readFileSync(path.join(ROOT, 'plugin', 'README.md'), 'utf8');

test('every scenario in both themes has a baseline', () => {
  const expected = ['noisy', 'healthy', 'fresh', 'broken']
    .flatMap((name) => ['light', 'dark'].map((theme) => `${name}-${theme}.png`))
    .sort();
  assert.deepEqual(Object.keys(MANIFEST.files).sort(), expected);
});

test('each baseline is the file the manifest describes', () => {
  for (const [name, want] of Object.entries(MANIFEST.files)) {
    const bytes = fs.readFileSync(path.join(DIR, name));
    assert.equal(bytes.length, want.bytes, `${name} size`);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), want.sha256, `${name} digest`);
  }
});

test('every baseline records the URL that reproduces it', () => {
  // A baseline without its recipe is an opinion: the last three images drifted
  // because they were taken with ?first=1 / ?failreport=1 and nothing said so.
  for (const name of Object.keys(MANIFEST.files)) {
    const url = MANIFEST.urls?.[name];
    assert.ok(url, `${name} has no url in the manifest`);
    const [scenario, theme] = name.replace(/\.png$/, '').split('-');
    assert.match(url, new RegExp(`scenario=${scenario}\\b`), `${name} names its scenario`);
    assert.match(url, new RegExp(`theme=${theme}\\b`), `${name} names its theme`);
  }
});

test('the preview takes its scenario and theme from the URL', () => {
  const preview = fs.readFileSync(path.join(ROOT, 'plugin', 'dev', 'preview.html'), 'utf8');
  assert.match(preview, /PARAMS\.get\('scenario'\)/);
  assert.match(preview, /PARAMS\.get\('theme'\)/);
  // Before the first render, or a screenshot catches the flip.
  const themeAt = preview.indexOf("setAttribute('data-theme', initialTheme)");
  const renderAt = preview.indexOf('ReactLite.rerender');
  assert.notEqual(themeAt, -1, 'the initial theme is applied');
  assert.ok(themeAt < renderAt, 'the theme is set before the first render');
});

test('the panel size the baselines were taken at is recorded', () => {
  assert.deepEqual(MANIFEST.viewport, { width: 420, height: 660 });
  assert.equal(MANIFEST.source, 'plugin/dev/preview.html');
});

test('re-capturing is documented where a contributor will look', () => {
  assert.match(README, /docs\/assets\/baseline/);
  assert.match(README, /check-baseline/);
});
