'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const fixture = path.join(__dirname, 'types', 'exports.ts');

// A production-only install (a packed tarball, or `npm install --omit=dev`)
// has no devDependencies, so TypeScript is not there to compile the fixture.
// Skip the compilation checks in that case instead of failing; they still run
// wherever the compiler is installed (`npm ci && npm test`).
let tsc = null;
try {
  tsc = require.resolve('typescript/bin/tsc');
} catch {
  // The skip reason below explains the missing compiler to the reader.
}
const tscSkipReason = tsc
  ? false
  : 'typescript is not installed (production-only install); run `npm ci` to type-check the declarations';

// node16/nodenext are what Node itself implements; bundler is the common setting
// for web tooling. All three use package.json "exports", so all three must find
// the "types" condition rather than guessing a declaration path.
const resolutions = [
  { module: 'node16', moduleResolution: 'node16' },
  { module: 'nodenext', moduleResolution: 'nodenext' },
  { module: 'esnext', moduleResolution: 'bundler' }
];

for (const config of resolutions) {
  test(`declarations resolve under moduleResolution ${config.moduleResolution}`, { skip: tscSkipReason }, () => {
    const result = spawnSync(
      process.execPath,
      [
        tsc,
        '--noEmit',
        '--strict',
        '--target', 'ES2022',
        '--module', config.module,
        '--moduleResolution', config.moduleResolution,
        fixture
      ],
      { cwd: root, encoding: 'utf8' }
    );

    assert.equal(
      result.status,
      0,
      `tsc (${config.moduleResolution}) failed:\n${result.stdout}${result.stderr}`
    );
  });
}

test('package.json publishes the declarations through the exports map', () => {
  const packageJson = require('../package.json');

  assert.equal(packageJson.types, 'lib/index.d.ts');
  assert.deepEqual(packageJson.exports['.'], {
    types: './lib/index.d.ts',
    default: './lib/index.js'
  });
});

test('the type fixture imports every runtime export', () => {
  const runtimeExports = Object.keys(require('../lib')).sort();
  const fixtureSource = require('fs').readFileSync(fixture, 'utf8');
  const imported = new Set();
  const importBlock = fixtureSource.match(/import \{([\s\S]*?)\} from 'ai-context-doctor';/);

  assert.ok(importBlock, 'the fixture has no named import from ai-context-doctor');
  for (const name of importBlock[1].split(',')) {
    const trimmed = name.trim();
    if (trimmed !== '') imported.add(trimmed);
  }

  assert.deepEqual([...imported].sort(), runtimeExports);
});
