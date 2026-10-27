#!/usr/bin/env node
// Validate market/index.json with the same parser DeepSeek Harness uses.
//
// The index format is strict: a wrong key fails at fetch time in the Harness
// UI, where the error is hard to see. This script fails in CI instead.
//
// Needs @deepseek-ai/dsh-plugin-market-index at runtime:
//   npm install --no-save @deepseek-ai/dsh-plugin-market-index
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'market', 'index.json');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const pluginPkg = JSON.parse(readFileSync(join(root, 'plugin', 'package.json'), 'utf8'));

// Icons and links must resolve without credentials, and the Harness rejects
// anything that is not https or same-origin as the index itself.
const repo = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
const indexUrl = `${repo.replace('github.com', 'raw.githubusercontent.com')}/main/market/index.json`;

let parseMarketIndex;
try {
  ({ parseMarketIndex } = await import('@deepseek-ai/dsh-plugin-market-index'));
} catch {
  console.error('Cannot find @deepseek-ai/dsh-plugin-market-index.');
  console.error('Install it first: npm install --no-save @deepseek-ai/dsh-plugin-market-index');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(indexPath, 'utf8'));
let index;
try {
  index = parseMarketIndex(raw, indexUrl);
} catch (error) {
  console.error(`market/index.json is invalid: ${error.message}`);
  process.exit(1);
}

const entry = index.plugins.find((plugin) => plugin.name === pluginPkg.name);
if (!entry) {
  console.error(`market/index.json does not list "${pluginPkg.name}".`);
  process.exit(1);
}

const version = entry.versions.find((v) => v.version === pluginPkg.version);
if (!version) {
  console.error(
    `market/index.json is missing version ${pluginPkg.version} of ${pluginPkg.name}.`,
  );
  process.exit(1);
}

const expectedDsh = pluginPkg.engines?.dsh;
if (expectedDsh && version.engines?.dsh !== expectedDsh) {
  console.error(
    `Engines mismatch: plugin declares dsh ${expectedDsh}, index says ${version.engines?.dsh}.`,
  );
  process.exit(1);
}

console.log(`market/index.json is valid (${index.plugins.length} plugin(s)).`);
console.log(`  index url: ${indexUrl}`);
console.log(`  entry: ${entry.name}@${version.version}`);
console.log(`  dsh range: ${version.engines?.dsh ?? 'unspecified'}`);
