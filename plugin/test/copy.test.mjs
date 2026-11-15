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

/**
 * A key nobody renders is a lie about what the panel says: the copy table
 * drifts from the UI, and the next reader cannot tell which half is real.
 * `phase*` keys are built by template (`tr(`phase${phase}`)`), so they are
 * checked by prefix rather than by literal.
 */
test('every declared key is actually rendered', () => {
  const orphans = keys('en').filter((key) => {
    if (key.startsWith('phase')) return CLIENT.includes('tr(`phase${phase}`)') === false;
    return CLIENT.includes(`'${key}'`) === false && CLIENT.includes(`\`${key}\``) === false;
  });
  assert.deepEqual(orphans, [], 'copy keys nothing renders');
});

test('one vocabulary for what the rules stop', () => {
  // "Held back" is the phrase a reader meets on the counter and in the list.
  // Mixing it with "blocked" made the same event sound like two different ones.
  assert.equal(CLIENT.includes("blockedTitle: 'Blocked from context'"), false);
  assert.equal(CLIENT.includes("blockedBadge: 'blocked'"), false);
  assert.match(CLIENT, /blockedTitle: 'Held back from the model'/);
  assert.match(CLIENT, /blockedTitle: '挡在模型之外'/);
});
