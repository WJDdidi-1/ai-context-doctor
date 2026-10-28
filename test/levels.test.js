'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { LEVELS, DEFAULT_LEVEL, levelFor, levelBlocksCategory } = require('../lib/levels');

test('levels run from off to strict, one step at a time', () => {
  assert.deepEqual(LEVELS.map((entry) => entry.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(LEVELS.map((entry) => entry.key), ['off', 'light', 'balanced', 'strong', 'strict']);
});

test('the recommended default is balanced', () => {
  assert.equal(DEFAULT_LEVEL, 3);
  assert.equal(levelFor(DEFAULT_LEVEL).key, 'balanced');
});

test('every level above the default narrows what gets through', () => {
  for (let index = 1; index < LEVELS.length; index += 1) {
    assert.ok(
      LEVELS[index].maxBytes <= LEVELS[index - 1].maxBytes,
      `level ${LEVELS[index].level} must not allow more bytes than level ${LEVELS[index - 1].level}`
    );
  }
});

test('off blocks nothing, balanced blocks the three structural categories', () => {
  assert.equal(levelBlocksCategory(levelFor(1), 'build'), false);
  assert.equal(levelBlocksCategory(levelFor(1), 'lockfile'), false);
  assert.equal(levelBlocksCategory(levelFor(3), 'build'), true);
  assert.equal(levelBlocksCategory(levelFor(3), 'lockfile'), true);
  assert.equal(levelBlocksCategory(levelFor(3), 'log'), true);
});

test('an unknown level falls back to the recommended one instead of throwing', () => {
  assert.equal(levelFor(99).key, 'balanced');
  assert.equal(levelFor(undefined).key, 'balanced');
  assert.equal(levelFor('3').key, 'balanced');
});

test('each level explains what it costs, so the slider is not a mystery', () => {
  for (const entry of LEVELS) {
    assert.ok(entry.note.length > 20, `level ${entry.level} needs a consequence sentence`);
  }
});
