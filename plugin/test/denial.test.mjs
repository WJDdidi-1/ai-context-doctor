import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-home-'));

import { formatDenial } from '../index.js';

const decision = {
  relativePath: 'dist/bundle.js',
  bytes: 146_000,
  reason: 'generated build output',
  tokens: { min: 33_000, max: 47_000 }
};

test('the refusal names the file, the reason, and the cost', () => {
  const message = formatDenial(decision);

  assert.match(message, /dist\/bundle\.js/);
  assert.match(message, /generated build output/);
  assert.match(message, /142\.6 KB/);
  assert.match(message, /tokens/);
});

test('the refusal tells the model to stop, not to look for a way around', () => {
  const message = formatDenial(decision);

  assert.match(message, /Do not retry/);
  assert.match(message, /do not try to read it another way/);
});

test('the refusal points at the one control that answers it', () => {
  const message = formatDenial(decision);

  // A "no" the user cannot answer is just an obstacle: the panel's Read once
  // button is the loop back, so the message has to name it.
  assert.match(message, /Read once/);
  assert.match(message, /AIignore panel/);
  assert.match(message, /strength/);
});

test('the refusal stays short enough to not crowd the context it saves', () => {
  const message = formatDenial(decision);

  assert.ok(message.length < 400, `denial message grew to ${message.length} characters`);
  assert.ok(message.split('\n').length === 1, 'one line, so it reads as a pause not a document');
});
