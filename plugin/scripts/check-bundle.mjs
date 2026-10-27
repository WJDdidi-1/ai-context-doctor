#!/usr/bin/env node
// Validate the bundle manifest the way the Plugin Manager reads it, without
// needing a Harness install: every declared resource must exist and resolve.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const problems = [];

const patch = manifest.dsh?.bundle?.patch;
if (!patch) {
  problems.push('package.json has no dsh.bundle.patch, so the Plugin Manager rejects it');
} else if (!fs.existsSync(path.join(root, patch))) {
  problems.push(`dsh.bundle.patch points at missing file ${patch}`);
}

const entry = manifest.exports?.['.'];
if (!entry || !fs.existsSync(path.join(root, entry))) {
  problems.push('exports["."] is missing or does not resolve');
} else {
  const module = await import(pathToFileURL(path.join(root, entry)).href);
  if (typeof module.apply !== 'function') {
    problems.push('the entry module must export apply(ctx, config)');
  }
}

if (!manifest.exports?.['./icon']) {
  problems.push('exports["./icon"] is missing, so the plugin row has no icon');
} else {
  const icon = path.join(root, manifest.exports['./icon'].replace('./', ''));
  if (!fs.existsSync(icon)) {
    problems.push(`icon ${icon} does not exist`);
  } else if (fs.statSync(icon).size > 256 * 1024) {
    problems.push('icon exceeds the 256 KiB limit');
  }
}

const localeDir = path.join(root, 'locale');
const locales = fs.existsSync(localeDir) ? fs.readdirSync(localeDir).filter((file) => file.endsWith('.json')) : [];
if (locales.length === 0) {
  problems.push('no locale files: the plugin shows no title or description');
}
for (const file of locales) {
  const data = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'));
  if (!data.meta?.title || !data.meta?.description) {
    problems.push(`locale/${file} is missing meta.title or meta.description`);
  }
}

for (const declared of manifest.files ?? []) {
  if (declared.includes('*')) continue;
  if (!fs.existsSync(path.join(root, declared))) {
    problems.push(`files declares ${declared}, which does not exist`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('Bundle manifest OK.');
