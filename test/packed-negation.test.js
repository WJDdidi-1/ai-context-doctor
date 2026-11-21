'use strict';

// The README says `*.md` followed by `!README.md` keeps the README, so verify
// that on the artifact a user installs, not just in this checkout: pack the
// tarball, install it into an empty directory, and run the installed CLI on the
// same fixture the README describes.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');

function npmInvocation() {
  // Under `npm test`, npm_execpath is the real npm-cli.js. Falling back to the
  // PATH entry covers `node --test`; Windows needs a shell to run npm.cmd.
  const execPath = process.env.npm_execpath;
  if (execPath && fs.existsSync(execPath)) {
    return { command: process.execPath, prefixArgs: [execPath], shell: false };
  }
  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    prefixArgs: [],
    shell: process.platform === 'win32'
  };
}

const npm = npmInvocation();
const npmProbe = spawnSync(npm.command, [...npm.prefixArgs, '--version'], {
  encoding: 'utf8',
  shell: npm.shell,
  timeout: 30000
});
const npmUnavailable = npmProbe.status !== 0;

function runNpm(args, options) {
  const result = spawnSync(npm.command, [...npm.prefixArgs, ...args], {
    encoding: 'utf8',
    shell: npm.shell,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120000,
    ...options
  });

  assert.equal(
    result.status,
    0,
    `npm ${args.join(' ')} failed (status ${result.status}):\n${result.stdout}\n${result.stderr}`
  );
  return result;
}

function runInstalledCli(bin, args) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 60000
  });
}

// Read the example out of the README itself, so a doc edit cannot leave the
// packed test asserting an example the README no longer shows.
function readmeNegationExample() {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const marker = '#### Order and `!`';
  const start = readme.indexOf(marker);
  assert.notEqual(start, -1, `README.md is missing the "${marker}" section`);

  const section = readme.slice(start + marker.length);
  const block = section.match(/```text\r?\n([\s\S]*?)```/);
  assert.ok(block, 'README.md has no text block under "Order and !"');

  return block[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

test('the packed CLI keeps README.md and still blocks NOTES.md for the README example', {
  skip: npmUnavailable ? 'npm is not available to pack and install the tarball' : false,
  timeout: 180000
}, (t) => {
  const example = readmeNegationExample();
  assert.deepEqual(example, ['*.md', '!README.md']);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-packed-negation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const packDir = path.join(root, 'pack');
  const installDir = path.join(root, 'install');
  const repoDir = path.join(root, 'repo');
  const cacheDir = path.join(root, 'npm-cache');
  for (const dir of [packDir, installDir, repoDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Same shape as the report that prompted the fix: two same-size Markdown
  // files, a broad rule and a negation. Nothing here is size- or category-noise,
  // so only the rules can explain the verdict.
  fs.writeFileSync(path.join(repoDir, '.aiignore'), ['# keep the readme', ...example].join('\n') + '\n');
  fs.writeFileSync(path.join(repoDir, 'README.md'), '#\n');
  fs.writeFileSync(path.join(repoDir, 'NOTES.md'), '#\n');

  // Keep npm's cache inside the fixture: a shared cache can be unwritable in
  // sandboxed test environments, and this install has no dependencies anyway.
  const npmEnv = {
    ...process.env,
    npm_config_cache: cacheDir,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false'
  };

  runNpm(['pack', '--pack-destination', packDir], { cwd: repoRoot, env: npmEnv });

  const tarball = fs.readdirSync(packDir).find((name) => name.endsWith('.tgz'));
  assert.ok(tarball, `npm pack wrote no .tgz file to ${packDir}`);

  runNpm([
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--no-package-lock',
    '--omit=dev',
    path.join(packDir, tarball)
  ], { cwd: installDir, env: npmEnv });

  const installedBin = path.join(installDir, 'node_modules', 'ai-context-doctor', 'bin', 'ai-context-doctor.js');
  assert.ok(fs.existsSync(installedBin), `installed tarball is missing ${installedBin}`);

  const scan = runInstalledCli(installedBin, ['--json', repoDir]);
  assert.equal(scan.status, 0, `packed --json failed:\n${scan.stdout}\n${scan.stderr}`);
  const report = JSON.parse(scan.stdout);
  assert.equal(report.schemaVersion, 1);

  const blockedPaths = report.blockedDetails.map((detail) => detail.path);
  assert.equal(blockedPaths.includes('README.md'), false, 'README.md should be allowed');
  assert.equal(blockedPaths.includes('NOTES.md'), true, 'NOTES.md should still be blocked');
  assert.equal(report.blockedFiles, 1);

  const notes = report.blockedDetails.find((detail) => detail.path === 'NOTES.md');
  assert.equal(notes.rule, '*.md');
  assert.equal(notes.matchedRule, '*.md');
  assert.equal(notes.blockedBy, 'rule');
  assert.equal(notes.source, 'rule');

  const kept = runInstalledCli(installedBin, ['--json', '--explain', 'README.md', repoDir]);
  assert.equal(kept.status, 0, `packed --explain README.md failed:\n${kept.stdout}\n${kept.stderr}`);
  const keptExplanation = JSON.parse(kept.stdout);
  assert.equal(keptExplanation.found, true);
  assert.equal(keptExplanation.verdict, 'not blocked');
  assert.equal(keptExplanation.rule.rule, '!README.md');

  // The text renderer keys the Rule line on a different field than the JSON
  // verdict, so check the packed CLI prints the releasing line too.
  const keptText = runInstalledCli(installedBin, ['--explain', 'README.md', repoDir]);
  assert.equal(keptText.status, 0, `packed text --explain README.md failed:\n${keptText.stdout}\n${keptText.stderr}`);
  assert.match(keptText.stdout, /Verdict: not blocked/);
  assert.match(keptText.stdout, /Rule: \.aiignore rule "!README\.md" \(re-included\)/);

  const stopped = runInstalledCli(installedBin, ['--json', '--explain', 'NOTES.md', repoDir]);
  assert.equal(stopped.status, 0, `packed --explain NOTES.md failed:\n${stopped.stdout}\n${stopped.stderr}`);
  const stoppedExplanation = JSON.parse(stopped.stdout);
  assert.equal(stoppedExplanation.found, true);
  assert.equal(stoppedExplanation.verdict, 'blocked');
  assert.equal(stoppedExplanation.rule.source, 'aiignore');
  assert.equal(stoppedExplanation.rule.rule, '*.md');
});
