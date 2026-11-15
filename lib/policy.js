'use strict';

const fs = require('fs');
const path = require('path');
const { levelFor, DEFAULT_LEVEL } = require('./levels');

// One file, one meaning. Keeping the policy where the project lives means the
// strength travels with the repository instead of with the machine.
const POLICY_FILE = '.aiignore.policy.json';

/**
 * The strength in force for a directory, falling back to the recommended one.
 *
 * @param {string} cwd
 * @returns {number}
 */
function readPolicy(cwd) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(cwd, POLICY_FILE), 'utf8'));
    return levelFor(raw.level).level;
  } catch {
    return DEFAULT_LEVEL;
  }
}

/**
 * Persist the strength for a directory.
 *
 * @param {string} cwd
 * @param {number} level
 * @returns {object} The level entry that was written.
 */
function writePolicy(cwd, level) {
  const entry = levelFor(level);
  fs.writeFileSync(
    path.join(cwd, POLICY_FILE),
    `${JSON.stringify({ level: entry.level, key: entry.key }, null, 2)}\n`
  );
  return entry;
}

module.exports = { POLICY_FILE, readPolicy, writePolicy };
