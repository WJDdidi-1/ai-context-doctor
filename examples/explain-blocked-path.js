#!/usr/bin/env node
'use strict';

// A self-contained example for `ai-context-doctor --explain`.
//
// It builds a tiny repository in the OS temp directory, runs the real CLI
// against it twice, and removes the fixture afterwards. The first run shows a
// lockfile blocked by the default strength; the second adds one `.aiignore`
// line and shows that the exact rule is named in the explanation.
//
// No network, no install, no dependencies beyond Node.js 18+.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cli = path.join(__dirname, '..', 'bin', 'ai-context-doctor.js');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-context-doctor-example-'));

const lockfile = {
  name: 'example-app',
  version: '1.0.0',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': {
      name: 'example-app',
      version: '1.0.0'
    },
    'node_modules/left-pad': {
      version: '1.3.0',
      resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz',
      integrity: 'sha512-example'
    }
  }
};

function write(relativePath, content) {
  const target = path.join(fixture, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function assertIncludes(output, expected, label) {
  if (!output.includes(expected)) {
    throw new Error(`${label} should include "${expected}"`);
  }
}

function explain(relativePath) {
  const result = spawnSync(process.execPath, [cli, '--explain', relativePath], {
    cwd: fixture,
    encoding: 'utf8'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(
      `--explain ${relativePath} exited with ${result.status}${detail === '' ? '' : `:\n${detail}`}`
    );
  }

  console.log(`$ ai-context-doctor --explain ${relativePath}`);
  console.log('');
  process.stdout.write(result.stdout);
  console.log('');
  return result.stdout;
}

function main() {
  write('src/index.js', "'use strict';\n\nconst answer = 42;\nmodule.exports = answer;\n");
  write('package-lock.json', `${JSON.stringify(lockfile, null, 2)}\n`);

  console.log('AI Context Doctor — runnable --explain example');
  console.log('');
  console.log('The fixture is a throwaway repository with one source file and one lockfile.');
  console.log('');

  console.log('1. With no .aiignore, the default strength decides:');
  console.log('');
  const lockfileOutput = explain('package-lock.json');
  assertIncludes(lockfileOutput, 'Verdict: blocked', 'lockfile explanation');
  assertIncludes(lockfileOutput, 'Rule: strength 3 (Balanced) skips lockfiles', 'lockfile explanation');
  assertIncludes(lockfileOutput, 'Category: lockfile', 'lockfile explanation');
  assertIncludes(lockfileOutput, 'Score impact:', 'lockfile explanation');

  write('.aiignore', 'src/index.js\n');

  console.log('2. After adding "src/index.js" to .aiignore, the exact rule is reported:');
  console.log('');
  const sourceOutput = explain('src/index.js');
  assertIncludes(sourceOutput, 'Verdict: blocked', 'source explanation');
  assertIncludes(sourceOutput, 'Rule: .aiignore rule "src/index.js"', 'source explanation');
  assertIncludes(sourceOutput, 'Category: none (not context noise)', 'source explanation');
  assertIncludes(sourceOutput, 'Score impact:', 'source explanation');

  console.log('Both runs call the same classification, rule matching and strength checks that the scan and the Harness panel use.');
}

let exitCode = 0;

try {
  main();
} catch (error) {
  console.error(`Example failed: ${error.message}`);
  exitCode = 1;
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

process.exitCode = exitCode;
