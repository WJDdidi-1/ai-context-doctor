import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Every label the panel can render exists twice. A missing Chinese key does not
 * throw — it shows the raw key to the user, which is worse than a broken build.
 */
const CLIENT = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8');

function keys(locale) {
  const start = CLIENT.indexOf(`      ${locale}: {`);
  assert.notEqual(start, -1, `locale ${locale} exists`);
  const end = CLIENT.indexOf('\n      },', start);
  const block = CLIENT.slice(start, end);
  return [...block.matchAll(/^        ([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1]).sort();
}

test('both locales declare exactly the same keys', () => {
  const en = keys('en');
  const zh = keys('zh');
  assert.equal(en.length > 30, true, 'the English block was parsed');
  assert.deepEqual(zh.filter((key) => en.includes(key) === false), [], 'Chinese has no extra keys');
  assert.deepEqual(en.filter((key) => zh.includes(key) === false), [], 'Chinese is missing keys');
});
