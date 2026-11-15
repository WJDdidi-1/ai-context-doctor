'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { scanRepository, buildReport } = require('../lib');

const bin = path.join(__dirname, '..', 'bin', 'ai-context-doctor.js');

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-blocked-'));
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return root;
}

function twoRuleRepo() {
  return fixture({
    'dist/bundle.js': 'x'.repeat(4000),
    'logs/dev.log': 'y'.repeat(2000),
    'src/app.js': 'z'.repeat(400),
    'README.md': '# demo\n'
  });
}

test('blocked files carry the matching rule, category and level', () => {
  const report = buildReport(twoRuleRepo(), { rules: ['dist/', '*.log'], level: 3 });

  assert.equal(report.blockedFiles, 2);
  assert.equal(report.blockedReasons.length, 2);

  const bundle = report.blockedReasons.find((item) => item.path === 'dist/bundle.js');
  assert.equal(bundle.rule, 'dist/');
  assert.equal(bundle.matchedRule, 'dist/');
  assert.equal(bundle.category, 'build');
  assert.equal(bundle.level, 3);
  assert.equal(bundle.levelLabel, 'Balanced');
  assert.equal(bundle.blockedBy, 'rule');

  const log = report.blockedReasons.find((item) => item.path === 'logs/dev.log');
  assert.equal(log.rule, '*.log');
  assert.equal(log.category, 'log');
  assert.equal(log.level, 3);
});

test('the path-labelled blocked view keeps the right rule per file', () => {
  const report = scanRepository(twoRuleRepo(), { rules: ['dist/', '*.log'], level: 3 });

  const build = report.blocked.find((item) => item.path === 'dist/');
  assert.equal(build.rule, 'dist/');
  assert.equal(build.category, 'build');
  assert.equal(build.level, 3);
  assert.deepEqual(build.files.map((item) => item.path), ['dist/bundle.js']);

  const log = report.blocked.find((item) => item.path === 'logs/dev.log');
  assert.equal(log.rule, '*.log');
  assert.equal(log.category, 'log');
});

test('allowed files are counted but never appear in the blocked explanations', () => {
  const report = scanRepository(twoRuleRepo(), { rules: ['dist/', '*.log'], level: 3 });
  const blockedPaths = report.blockedReasons.map((item) => item.path);

  assert.equal(report.allowedFiles, 2);
  assert.deepEqual(blockedPaths.includes('src/app.js'), false);
  assert.deepEqual(blockedPaths.includes('README.md'), false);
  assert.deepEqual(report.allowedFiles, report.scannedFiles - report.blockedFiles);
});

test('an unmatched rule blocks nothing and leaves the effective score alone', () => {
  const report = scanRepository(twoRuleRepo(), { rules: ['*.lock'], level: 1 });

  assert.equal(report.blockedFiles, 0);
  assert.deepEqual(report.blocked, []);
  assert.deepEqual(report.blockedDetails, []);
  assert.equal(report.effectiveScore, report.healthScore);
});

test('a file blocked by the level says so, with no rule and the level that did it', () => {
  const root = fixture({
    'data/export.json': 'x'.repeat(1536 * 1024),
    'src/app.js': 'ok'
  });
  const report = scanRepository(root, { level: 3 });

  assert.equal(report.blockedFiles, 1);
  const [entry] = report.blockedDetails;
  assert.equal(entry.path, 'data/export.json');
  assert.equal(entry.rule, null);
  assert.equal(entry.level, 3);
  assert.equal(entry.category, 'large');
  assert.equal(entry.blockedBy, 'level');
  assert.equal(entry.levelReason, 'size');
});

test('--json lists the same blocked explanations as the library', () => {
  const root = twoRuleRepo();
  fs.writeFileSync(path.join(root, '.aiignore'), 'dist/\n*.log\n');
  fs.writeFileSync(path.join(root, '.aiignore.policy.json'), JSON.stringify({ level: 3 }));

  const report = JSON.parse(execFileSync(process.execPath, [bin, '--json', root], { encoding: 'utf8' }));

  assert.deepEqual(
    report.blockedDetails.map((item) => [item.path, item.rule, item.category, item.level]),
    [
      ['dist/bundle.js', 'dist/', 'build', 3],
      ['logs/dev.log', '*.log', 'log', 3]
    ]
  );
  assert.deepEqual(report.blockedReasons, report.blockedDetails);
});
