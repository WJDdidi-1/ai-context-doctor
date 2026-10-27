'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  isSecretLikeFile,
  isTemplateFile,
  formatBytes,
  statusFor
} = require('../lib/rules');

test('flags environment-like file names', () => {
  for (const name of ['.env', '.env.production', 'secrets.env', 'credentials.json', 'server.pem', 'id.key']) {
    assert.equal(isSecretLikeFile(name), true, `${name} should be flagged`);
  }
});

test('does not flag ordinary source files', () => {
  for (const name of ['index.js', 'README.md', 'package.json', 'env.md']) {
    assert.equal(isSecretLikeFile(name), false, `${name} should not be flagged`);
  }
});

test('recognises templates', () => {
  assert.equal(isTemplateFile('.env.example'), true);
  assert.equal(isTemplateFile('config.sample'), true);
  assert.equal(isTemplateFile('index.js'), false);
});

test('formats byte counts at each unit boundary', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1023), '1023 B');
  assert.equal(formatBytes(1024), '1.00 KB');
  assert.equal(formatBytes(1024 * 1024), '1.00 MB');
  assert.equal(formatBytes(15.5 * 1024 * 1024), '15.5 MB');
});

test('maps health scores to plain-language status', () => {
  assert.equal(statusFor(100), 'Looks clean for an AI coding agent');
  assert.equal(statusFor(85), 'Looks clean for an AI coding agent');
  assert.equal(statusFor(84), 'Some context noise found');
  assert.equal(statusFor(60), 'Some context noise found');
  assert.equal(statusFor(59), 'Too much noise for an AI coding agent');
  assert.equal(statusFor(0), 'Too much noise for an AI coding agent');
});
