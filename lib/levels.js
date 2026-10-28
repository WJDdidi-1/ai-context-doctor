'use strict';

/**
 * How hard the guard filters, as data rather than prose.
 *
 * The panel shows this as one slider: move right, fewer bytes reach the model,
 * more risk that something you wanted gets hidden. Every level states both.
 */
const LEVELS = [
  {
    level: 1,
    key: 'off',
    label: 'Off',
    maxBytes: Infinity,
    categories: [],
    note: 'Only .aiignore rules apply. The agent reads everything else.'
  },
  {
    level: 2,
    key: 'light',
    label: 'Light',
    maxBytes: 4 * 1024 * 1024,
    categories: ['build'],
    note: 'Skips generated output. Anything you wrote by hand still gets through.'
  },
  {
    level: 3,
    key: 'balanced',
    label: 'Balanced',
    maxBytes: 1024 * 1024,
    categories: ['build', 'lockfile', 'log'],
    note: 'Skips generated output, lockfiles, logs and files over 1 MB. The recommended default.'
  },
  {
    level: 4,
    key: 'strong',
    label: 'Strong',
    maxBytes: 256 * 1024,
    categories: ['build', 'lockfile', 'log'],
    note: 'Also skips files over 256 KB, so large hand-written files stop reaching the agent.'
  },
  {
    level: 5,
    key: 'strict',
    label: 'Strict',
    maxBytes: 64 * 1024,
    categories: ['build', 'lockfile', 'log'],
    note: 'Skips files over 64 KB. Data files, long documents and big fixtures will be hidden too.'
  }
];

const DEFAULT_LEVEL = 3;

/**
 * Look a level up by number, falling back to the recommended default.
 *
 * @param {number} level
 * @returns {object}
 */
function levelFor(level) {
  const wanted = Number(level);
  return LEVELS.find((entry) => entry.level === wanted) || LEVELS[DEFAULT_LEVEL - 1];
}

/**
 * Whether a level blocks a given kind of noise.
 *
 * @param {object} level Entry from LEVELS.
 * @param {'build' | 'lockfile' | 'log' | 'large'} category
 * @returns {boolean}
 */
function levelBlocksCategory(level, category) {
  return Array.isArray(level.categories) && level.categories.includes(category);
}

module.exports = { LEVELS, DEFAULT_LEVEL, levelFor, levelBlocksCategory };
