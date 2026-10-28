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

test('--write creates .aiignore with the suggested rules', () => {
  const root = tempRepo({ 'src/index.js': 'const a = 1;\n', 'package-lock.json': 'x'.repeat(1000) });
  const out = execFileSync(process.execPath, [bin, '--write', root], { encoding: 'utf8' });
  const written = fs.readFileSync(path.join(root, '.aiignore'), 'utf8');

  assert.match(out, /Created \.aiignore with \d+ rule\(s\)\./);
  assert.match(written, /package-lock\.json/);
});

test('--write is idempotent and keeps hand-written rules', () => {
  const root = tempRepo({ 'package-lock.json': 'x'.repeat(1000) });
  fs.writeFileSync(path.join(root, '.aiignore'), '# mine\nalready-here/\n');

  execFileSync(process.execPath, [bin, '--write', root], { encoding: 'utf8' });
  const first = fs.readFileSync(path.join(root, '.aiignore'), 'utf8');
  const second = execFileSync(process.execPath, [bin, '--write', root], { encoding: 'utf8' });

  assert.match(first, /^# mine\nalready-here\/\n/);
  assert.match(second, /\.aiignore already covers every suggestion\./);
  assert.equal(fs.readFileSync(path.join(root, '.aiignore'), 'utf8'), first);
});

test('--write --dry-run writes nothing', () => {
  const root = tempRepo({ 'package-lock.json': 'x'.repeat(1000) });
  const out = execFileSync(process.execPath, [bin, '--write', '--dry-run', root], { encoding: 'utf8' });

  assert.match(out, /Would add \d+ rule\(s\) to \.aiignore \(dry run, nothing written\)\./);
  assert.equal(fs.existsSync(path.join(root, '.aiignore')), false);
});

test('--json --write reports what it would change', () => {
  const root = tempRepo({ 'package-lock.json': 'x'.repeat(1000) });
  const out = execFileSync(process.execPath, [bin, '--json', '--write', root], { encoding: 'utf8' });
  const report = JSON.parse(out);

  assert.equal(report.write.written, true);
  assert.equal(report.write.created, true);
  assert.ok(report.write.added.includes('package-lock.json'));
});

test('an unknown option is rejected instead of being treated as a directory', () => {
  const result = spawnSync(process.execPath, [bin, '--writ'], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option: --writ/);
});

test('--dry-run without --write is rejected', () => {
  const result = spawnSync(process.execPath, [bin, '--dry-run'], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /only applies to --write/);
});
