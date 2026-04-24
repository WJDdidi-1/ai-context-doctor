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

const missingDir = run(['./missing-smoke-test-directory']);
assert(missingDir.status !== 0, 'missing directory scan should fail');
assertIncludes(missingDir, 'not a readable directory', 'missing directory output');

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-context-doctor-smoke-'));
const largeFile = path.join(fixtureDir, 'export.json');
fs.writeFileSync(path.join(fixtureDir, 'index.js'), 'console.log("small source");\n');
fs.writeFileSync(largeFile, Buffer.alloc((1024 * 1024) + 1));

const largeFileScan = run([fixtureDir]);
assert(largeFileScan.status === 0, 'large file fixture scan should exit with 0');
assertIncludes(largeFileScan, 'export.json', 'large file fixture output');
assertIncludes(largeFileScan, 'large file', 'large file fixture output');

fs.rmSync(fixtureDir, { recursive: true, force: true });

console.log('Smoke tests passed.');
