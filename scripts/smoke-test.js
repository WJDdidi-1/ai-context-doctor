#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(repoRoot, 'bin', 'ai-context-doctor.js');
const node = process.execPath;

function run(args, options = {}) {
  return spawnSync(node, [cliPath, ...args], {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8'
  });
}

function outputOf(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Smoke test failed: ${message}`);
    process.exit(1);
  }
}

function assertIncludes(result, text, label) {
  assert(outputOf(result).includes(text), `${label} should include "${text}"`);
}

const help = run(['--help']);
assert(help.status === 0, '--help should exit with 0');
assertIncludes(help, 'Usage:', '--help output');
assertIncludes(help, 'node bin/ai-context-doctor.js [directory]', '--help output');

const currentDir = run([]);
assert(currentDir.status === 0, 'current directory scan should exit with 0');
assertIncludes(currentDir, 'AI Context Health', 'current directory output');
assertIncludes(currentDir, 'Top context waste', 'current directory output');

const jsonScan = run(['--json', './demo-ai-context-noise-repo']);
assert(jsonScan.status === 0, '--json scan should exit with 0');
let parsedJson;
try {
  parsedJson = JSON.parse(jsonScan.stdout);
} catch {
  assert(false, '--json output should be valid JSON');
}
assert(typeof parsedJson.healthScore === 'number', '--json output should include healthScore');
assert(Array.isArray(parsedJson.topNoise), '--json output should include topNoise array');

const missingDir = run(['./missing-smoke-test-directory']);
assert(missingDir.status !== 0, 'missing directory scan should fail');
assertIncludes(missingDir, 'not a readable directory', 'missing directory output');

// --json is for scripts and CI, so its failure path must stay parseable too.
const missingDirJson = run(['--json', './missing-smoke-test-directory']);
assert(missingDirJson.status !== 0, '--json missing directory scan should fail');
let jsonError;
try {
  jsonError = JSON.parse(missingDirJson.stdout);
} catch {
  assert(false, '--json output on failure should be valid JSON');
}
assert(jsonError.error === 'not-a-readable-directory', '--json failure should carry an error code');
assert(typeof jsonError.message === 'string', '--json failure should carry a message');

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-context-doctor-smoke-'));
const largeFile = path.join(fixtureDir, 'export.json');
fs.writeFileSync(path.join(fixtureDir, 'index.js'), 'console.log("small source");\n');
fs.writeFileSync(largeFile, Buffer.alloc((1024 * 1024) + 1));

const largeFileScan = run([fixtureDir]);
assert(largeFileScan.status === 0, 'large file fixture scan should exit with 0');
assertIncludes(largeFileScan, 'export.json', 'large file fixture output');
assertIncludes(largeFileScan, 'large file', 'large file fixture output');

// Review rules: credential-style names must be flagged; templates and
// unrelated names containing "env"/"key" must not be flagged as secrets.
const reviewDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-context-doctor-review-'));
for (const name of ['secrets.env', 'credentials.json', '.env.production', 'server.pem', '.env.example', 'keyboard.js', 'environment.md']) {
  fs.writeFileSync(path.join(reviewDir, name), 'x\n');
}
const reviewScan = run(['--json', reviewDir]);
assert(reviewScan.status === 0, 'review fixture scan should exit with 0');
const reviewed = JSON.parse(reviewScan.stdout).review;
const flagged = (name) => reviewed.find((item) => item.path === name);
assert(flagged('secrets.env') && flagged('secrets.env').reason === 'environment-like file', 'secrets.env should be flagged');
assert(flagged('credentials.json') && flagged('credentials.json').reason === 'environment-like file', 'credentials.json should be flagged');
assert(flagged('server.pem') && flagged('server.pem').reason === 'environment-like file', 'server.pem should be flagged');
assert(flagged('.env.example') && flagged('.env.example').reason.startsWith('environment template'), '.env.example should be a template, not a secret');
assert(!flagged('keyboard.js'), 'keyboard.js must not be flagged');
assert(!flagged('environment.md'), 'environment.md must not be flagged');
fs.rmSync(reviewDir, { recursive: true, force: true });

fs.rmSync(fixtureDir, { recursive: true, force: true });

console.log('Smoke tests passed.');
