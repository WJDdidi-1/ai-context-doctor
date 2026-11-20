'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const loadHelpers = () => import('../scripts/market-index.mjs');

test('findDuplicateVersions reports a version listed twice in one plugin', async () => {
  const { findDuplicateVersions } = await loadHelpers();
  const index = {
    plugins: [
      {
        name: 'dsh-plugin-toolkit',
        versions: [
          { version: '0.14.0' },
          { version: '0.20.48' },
          { version: '0.14.0' },
        ],
      },
    ],
  };

  assert.deepEqual(findDuplicateVersions(index), [
    {
      plugin: 'dsh-plugin-toolkit',
      version: '0.14.0',
      firstIndex: 0,
      duplicateIndex: 2,
    },
  ]);
});

test('findDuplicateVersions allows the same version in different plugins', async () => {
  const { findDuplicateVersions } = await loadHelpers();
  const index = {
    plugins: [
      { name: 'dsh-aiignore', versions: [{ version: '0.14.0' }] },
      { name: 'dsh-plugin-toolkit', versions: [{ version: '0.14.0' }] },
    ],
  };

  assert.deepEqual(findDuplicateVersions(index), []);
});

test('describeDuplicateVersions says the new record should be removed', async () => {
  const { describeDuplicateVersions } = await loadHelpers();
  const message = describeDuplicateVersions([
    {
      plugin: 'dsh-plugin-toolkit',
      version: '0.14.0',
      firstIndex: 0,
      duplicateIndex: 49,
    },
  ]);

  assert.match(message, /dsh-plugin-toolkit lists version 0\.14\.0 twice/);
  assert.match(message, /versions\[0\] and versions\[49\]/);
  assert.match(message, /npm versions are immutable/);
  assert.match(message, /remove the added record/);
});

// This is the rule the market check failed on in #260: the branch appended a
// second 0.14.0 record. Keep the checked-in index clean even when the external
// parser is not installed.
test('the checked-in market/index.json has no duplicate versions', async () => {
  const { findDuplicateVersions } = await loadHelpers();
  const indexPath = path.join(__dirname, '..', 'market', 'index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  assert.deepEqual(findDuplicateVersions(index), []);
});
