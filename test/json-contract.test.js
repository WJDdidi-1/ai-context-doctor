'use strict';

// scripts/run-tests.js discovers `test/*.test.js`. The JSON contract suite is a
// `.mjs` file because that is the convention the product spec names, so this
// small runner executes it as a child process. `node:test` also runs a file
// directly, which keeps this working on every Node version the package supports
// (and `node --test test/json-contract.test.mjs` works too).

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

test('json-contract.test.mjs', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'json-contract.test.mjs')],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
