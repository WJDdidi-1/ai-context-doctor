'use strict';

// The README promises the `--json` shape to CI scripts, so verify the shipped
// artifact, not just the checkout: pack the tarball, install it into an empty
// directory, and run the CLI a user would get. This is the check that notices a
// file missing from package.json "files" or a contract that only exists in the
// working tree.

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

test('the packed tarball carries schemaVersion on success and on error', {
  skip: npmUnavailable ? 'npm is not available to pack and install the tarball' : false,
  timeout: 180000
}, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-packed-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const packDir = path.join(root, 'pack');
  const installDir = path.join(root, 'install');
  const repoDir = path.join(root, 'repo');
  const cacheDir = path.join(root, 'npm-cache');
  for (const dir of [packDir, installDir, repoDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'index.js'), 'const a = 1;\n');
  fs.writeFileSync(path.join(repoDir, 'package-lock.json'), 'x'.repeat(1000));

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

  const installedPackage = path.join(installDir, 'node_modules', 'ai-context-doctor');
  const installedBin = path.join(installedPackage, 'bin', 'ai-context-doctor.js');
  assert.ok(fs.existsSync(installedBin), `installed tarball is missing ${installedBin}`);

  const scan = runInstalledCli(installedBin, ['--json', repoDir]);
  assert.equal(scan.status, 0, `packed --json failed:\n${scan.stdout}\n${scan.stderr}`);
  const report = JSON.parse(scan.stdout);
  assert.equal(report.schemaVersion, 1);
  assert.equal(Object.keys(report)[0], 'schemaVersion');
  assert.equal(typeof report.healthScore, 'number');

  const missing = path.join(root, 'missing-from-packed-install');
  const failure = runInstalledCli(installedBin, ['--json', missing]);
  assert.equal(failure.status, 1, `packed --json error path failed:\n${failure.stdout}\n${failure.stderr}`);
  const payload = JSON.parse(failure.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(Object.keys(payload)[0], 'schemaVersion');
  assert.equal(payload.error, 'not-a-readable-directory');
  assert.equal(payload.target, missing);
});
