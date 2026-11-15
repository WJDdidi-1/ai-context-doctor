'use strict';

// Root test entry point.
//
// `node --test` with no arguments also discovers plugin/test/, which needs the
// plugin's own dependency install (a different package with its own lockfile).
// Passing `test/` as a directory argument is not portable either: Node 24
// treats it as a file. So list the root test files explicitly, and let the
// plugin job run its own suite.

const { spawnSync } = require('child_process');
const { readdirSync } = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '..', 'test');
const files = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join('test', name));

if (files.length === 0) {
  console.error('No test files found in test/.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
