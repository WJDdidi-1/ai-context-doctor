#!/usr/bin/env node
// The browser half ships as one file, so panel.css lives inside client.js as a
// template literal. This keeps the two in step: run it after editing the CSS.
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(root, 'ui', 'panel.css'), 'utf8');
const clientPath = path.join(root, 'client.js');
const client = fs.readFileSync(clientPath, 'utf8');

const marker = 'const CSS = String.raw`';
const start = client.indexOf(marker);
if (start === -1) throw new Error('inline-styles: CSS template not found in client.js');

const from = start + marker.length;
const end = client.indexOf('`', from);
if (end === -1) throw new Error('inline-styles: CSS template is not closed');

if (css.includes('`')) throw new Error('inline-styles: panel.css contains a backtick');

const next = client.slice(0, from) + css + client.slice(end);
if (next === client) {
  console.log('inline-styles: already up to date.');
} else {
  fs.writeFileSync(clientPath, next);
  console.log(`inline-styles: wrote ${css.length} bytes of CSS into client.js.`);
}
