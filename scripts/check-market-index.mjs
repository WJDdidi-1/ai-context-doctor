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

// The index describes what is on the registry, not what is in the working
// tree: a rename has to land in the registry before the index can point at it,
// so the local package may legitimately be absent for a while. Absence warns;
// a listed entry still has to match exactly.
const entry = index.plugins.find((plugin) => plugin.name === pluginPkg.name);
if (!entry) {
  console.warn(
    `market/index.json does not list "${pluginPkg.name}" — not published under that name yet.`,
  );
  console.log(`market/index.json is valid (${index.plugins.length} plugin(s)).`);
  process.exit(0);
}

// Same reasoning one step further in: a version cannot enter the index before
// it is on the registry, and its publish timestamp only exists after the
// publish. Bumping the manifest therefore runs ahead of the index on purpose.
// A listed version must still agree with the manifest; a missing one warns.
const version = entry.versions.find((v) => v.version === pluginPkg.version);

const expectedDsh = pluginPkg.engines?.dsh;
if (version && expectedDsh && version.engines?.dsh !== expectedDsh) {
  console.error(
    `Engines mismatch: plugin declares dsh ${expectedDsh}, index says ${version.engines?.dsh}.`,
  );
  process.exit(1);
}

console.log(`market/index.json is valid (${index.plugins.length} plugin(s)).`);
console.log(`  index url: ${indexUrl}`);
if (version) {
  console.log(`  entry: ${entry.name}@${version.version}`);
  console.log(`  dsh range: ${version.engines?.dsh ?? 'unspecified'}`);
} else {
  console.warn(
    `  ${pluginPkg.name}@${pluginPkg.version} is not in the index yet — it lists `
    + `${entry.versions.map((v) => v.version).join(', ')}. Add it after publishing.`,
  );
}
