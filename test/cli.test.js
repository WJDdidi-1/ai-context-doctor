'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const bin = path.join(__dirname, '..', 'bin', 'ai-context-doctor.js');

function tempRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-cli-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

test('--version prints the package version', () => {
  const out = execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8' });
  assert.equal(out.trim(), require('../package.json').version);
});

test('--json emits a parseable report', () => {
  const root = tempRepo({ 'src/index.js': 'const a = 1;\n', 'package-lock.json': 'x'.repeat(1000) });
  const out = execFileSync(process.execPath, [bin, '--json', root], { encoding: 'utf8' });
  const report = JSON.parse(out);

  assert.equal(report.repo, path.basename(root));
  assert.equal(report.scannedFiles, 2);
  assert.equal(typeof report.healthScore, 'number');
  assert.equal(report.status, 'Too much noise for an AI coding agent');
});

test('--json error path stays machine-readable', () => {
  const result = spawnSync(process.execPath, [bin, '--json', './does-not-exist-aicd'], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.error, 'not-a-readable-directory');
  assert.equal(payload.target, './does-not-exist-aicd');
});

test('text mode explains a missing directory on stderr', () => {
  const result = spawnSync(process.execPath, [bin, './does-not-exist-aicd'], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /AI Context Doctor/);
  assert.match(result.stderr, /is not a readable directory/);
});
