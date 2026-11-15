#!/usr/bin/env node
// Guards the visual baselines in docs/assets/baseline.
//
// The panel is styled by hand and its screenshots are the only record of what
// it is supposed to look like. Nothing regenerates them automatically (there is
// no headless browser in this repository), so this script does the part that
// can be automated: it fails when a baseline was edited, deleted or committed
// half-written, which is how a "fix" silently becomes a redesign.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'assets', 'baseline');
const MANIFEST = path.join(DIR, 'manifest.json');

const fail = (message) => {
  console.error(`check-baseline: ${message}`);
  process.exitCode = 1;
};

if (!fs.existsSync(MANIFEST)) {
  fail('docs/assets/baseline/manifest.json is missing');
} else {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const files = manifest.files || {};
  const names = Object.keys(files).sort();

  if (names.length !== 8) {
    fail(`expected 8 baselines (four scenarios × two themes), manifest lists ${names.length}`);
  }

  // Every image has to name the URL that produces it. Three of these were once
  // captured with query flags nobody wrote down, so they could not be
  // reproduced and the drift looked like a rendering bug.
  const urls = manifest.urls || {};
  for (const name of names) {
    const url = urls[name];
    if (typeof url !== 'string' || url === '') {
      fail(`${name} has no url in the manifest, so nobody can re-capture it`);
      continue;
    }
    const [scenario, theme] = name.replace(/\.png$/, '').split('-');
    if (!url.includes(`scenario=${scenario}`) || !url.includes(`theme=${theme}`)) {
      fail(`${name} records ${url}, which does not reproduce ${scenario}/${theme}`);
    }
  }

  for (const name of names) {
    const file = path.join(DIR, name);
    if (!fs.existsSync(file)) {
      fail(`${name} is listed but missing`);
      continue;
    }
    const bytes = fs.readFileSync(file);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    const want = files[name];
    if (bytes.length !== want.bytes) {
      fail(`${name} is ${bytes.length} bytes, manifest says ${want.bytes}`);
    }
    if (digest !== want.sha256) {
      fail(`${name} changed since the manifest was written`);
    }
  }

  for (const name of fs.readdirSync(DIR)) {
    if (name.endsWith('.png') && names.includes(name) === false) {
      fail(`${name} is not in the manifest`);
    }
  }

  if (process.exitCode !== 1) {
    console.log(`check-baseline: ${names.length} baselines match the manifest.`);
  }
}
