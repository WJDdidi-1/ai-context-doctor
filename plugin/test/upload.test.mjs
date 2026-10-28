import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { uploadFile } from '../index.js';

/** A PNG header is enough: the route sniffs the type, it does not decode. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(120, 7)
]);

function stored(home, digest, bytes) {
  const directory = path.join(home, 'attachments', 'v1', 'objects', digest.slice(0, 2));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, digest), bytes);
  return path.join(directory, digest);
}

const DIGEST = 'a'.repeat(64);
const TEXT_DIGEST = 'b'.repeat(64);

test('an upload resolves by digest, with the type read from its magic bytes', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-upload-'));
  stored(home, DIGEST, PNG);

  const found = uploadFile(DIGEST, home);
  assert.notEqual(found, null);
  assert.equal(found.type, 'png');
  assert.equal(found.absolute.endsWith(path.join('aa', DIGEST)), true);
});

test('a digest that is not 64 hex characters never reaches the filesystem', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-upload-'));
  stored(home, DIGEST, PNG);

  for (const bad of ['', '../../etc/passwd', 'A'.repeat(64), 'a'.repeat(63), `${'a'.repeat(62)}/..`]) {
    assert.equal(uploadFile(bad, home), null, `accepted ${JSON.stringify(bad)}`);
  }
});

test('a digest with nothing behind it resolves to null', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-upload-'));
  assert.equal(uploadFile('c'.repeat(64), home), null);
});

test('a non-image upload is still resolvable, and typed as text', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-upload-'));
  stored(home, TEXT_DIGEST, Buffer.from('just some notes\n'));
  assert.equal(uploadFile(TEXT_DIGEST, home).type, 'file');
});
