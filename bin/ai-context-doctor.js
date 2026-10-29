#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const packageInfo = require('../package.json');
const { scanRepository, formatBytes, statusFor, writeAiignore, parseRules, readPolicy, levelFor } = require('../lib');

const args = process.argv.slice(2);
const KNOWN_FLAGS = ['--json', '--write', '--dry-run', '--help', '--version'];

const unknownFlag = args.find((arg) => arg.startsWith('--') && !KNOWN_FLAGS.includes(arg));

if (unknownFlag) {
  console.error(`Unknown option: ${unknownFlag}`);
  console.error('Run with --help to see the available options.');
  process.exit(1);
}

const jsonOutput = args.includes('--json');
const writeOutput = args.includes('--write');
const dryRun = args.includes('--dry-run');
const positional = args.filter((arg) => !arg.startsWith('--'));
const firstArg = positional[0];

if (args.includes('--help')) {
  printHelp();
  process.exit(0);
}

if (args.includes('--version')) {
  console.log(packageInfo.version);
  process.exit(0);
}

if (dryRun && !writeOutput) {
  console.error('--dry-run only applies to --write. Pass both, or drop --dry-run.');
  process.exit(1);
}

const targetArg = firstArg;
const cwd = targetArg ? path.resolve(process.cwd(), targetArg) : process.cwd();

function printHelp() {
  console.log('AI Context Doctor');
  console.log('');
  console.log('Find what your AI coding agent should not read.');
  console.log('');
  console.log('Usage:');
  console.log('  node bin/ai-context-doctor.js [directory]');
  console.log('');
  console.log('Options:');
  console.log('  --help      Show this help.');
  console.log('  --version   Print the package version.');
  console.log('  --json      Print the report as JSON for scripts and CI.');
  console.log('  --write     Add the suggested rules to .aiignore in the scanned directory.');
  console.log('  --dry-run   With --write, show what would be added without writing.');
  console.log('');
  console.log('Examples:');
  console.log('  node bin/ai-context-doctor.js');
  console.log('  node bin/ai-context-doctor.js ../some-repo');
  console.log('  node bin/ai-context-doctor.js --write');
  console.log('  node bin/ai-context-doctor.js --write --dry-run');
  console.log('');
  console.log('What it does:');
  console.log('  Scans a local directory for obvious context noise.');
  console.log('  Prints a heuristic, screenshot-friendly report.');
  console.log('');
  console.log('Notes:');
  console.log('  No login. No API key. No files uploaded.');
  console.log('  Results are heuristic, not a precise token or security analysis.');
}

function exitWithDirectoryError() {
  const target = targetArg || cwd;
  if (jsonOutput) {
    console.log(JSON.stringify({
      error: 'not-a-readable-directory',
      message: `${target} is not a readable directory.`,
      target
    }, null, 2));
    process.exit(1);
  }
  console.log('AI Context Doctor');
  console.log('');
  console.error(`Error: ${target} is not a readable directory.`);
  process.exit(1);
}

function assertReadableDirectory(dir) {
  let stats;

  try {
    stats = fs.statSync(dir);
    fs.accessSync(dir, fs.constants.R_OK);
  } catch {
    exitWithDirectoryError();
  }

  if (!stats.isDirectory()) {
    exitWithDirectoryError();
  }
}

function printScoreBreakdown(breakdown) {
  for (const item of breakdown) {
    const lost = `${item.lost}`.padStart(5);
    console.log(`  ${item.label.padEnd(22)} -${lost} / ${item.weight}`);
  }
}

function printTable(items, emptyMessage) {
  if (items.length === 0) {
    console.log(emptyMessage);
    return;
  }

  items.forEach((item, index) => {
    const name = `${index + 1}. ${item.path}`.padEnd(28);
    const size = formatBytes(item.bytes).padStart(9);
    console.log(`${name} ${size}   ${item.reason}`);
  });
}

assertReadableDirectory(cwd);

// The CLI reads the same two files the guard reads, so its numbers describe what
// an agent in this folder would actually be handed — not a hypothetical scan.
function localRules() {
  try {
    return parseRules(fs.readFileSync(path.join(cwd, '.aiignore'), 'utf8'));
  } catch {
    return [];
  }
}

const level = readPolicy(cwd);
const report = scanRepository(cwd, { rules: localRules(), level });

let writeResult = null;

if (writeOutput) {
  try {
    writeResult = writeAiignore(path.join(cwd, '.aiignore'), report.suggestedAiignore, { dryRun });
  } catch (error) {
    if (jsonOutput) {
      console.log(JSON.stringify({
        error: error.code || 'write-failed',
        message: error.message,
        target: path.join(cwd, '.aiignore')
      }, null, 2));
      process.exit(1);
    }
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (jsonOutput) {
  const output = writeResult
    ? {
        ...report,
        write: {
          path: writeResult.path,
          created: writeResult.created,
          added: writeResult.added,
          written: writeResult.written,
          dryRun: writeResult.dryRun
        }
      }
    : report;
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

const { repo, scannedFiles, scannedBytes, healthScore, noisePercent, usefulPercent } = report;

console.log('AI Context Doctor');
console.log('');
console.log(`Repo: ${repo}`);
console.log(`Scanned: ${scannedFiles} files, ${formatBytes(scannedBytes)}`);
console.log('');
console.log(`AI Context Health: ${healthScore}/100`);
console.log(`Status: ${statusFor(healthScore)}`);
console.log('');
console.log(`What reaches the model: ${report.effectiveScore}/100`);
console.log(`  strength ${levelFor(level).level} (${levelFor(level).label}) · ${formatBytes(report.allowedBytes)} of ${formatBytes(scannedBytes)} let through`);
console.log('');
console.log('Where the points go:');
printScoreBreakdown(report.scoreBreakdown);
console.log('');
console.log('Context noise estimate:');
console.log(`${noisePercent}% likely noise`);
console.log(`${usefulPercent}% likely useful source context`);
console.log('');
console.log('Top context waste:');
printTable(report.topNoise, 'No obvious context waste found.');
console.log('');
console.log('Review before sharing:');
if (report.review.length === 0) {
  console.log('No environment-like files or deployment scripts found.');
} else {
  for (const item of report.review) {
    console.log(`- ${item.path.padEnd(24)} ${item.reason}`);
  }
}
console.log('');
console.log('Suggested .aiignore:');
if (report.suggestedAiignore.length === 0) {
  console.log('No suggestions yet.');
} else {
  for (const suggestion of report.suggestedAiignore) {
    console.log(suggestion);
  }
}
if (writeResult) {
  console.log('');
  console.log('.aiignore:');
  const relative = path.relative(cwd, writeResult.path) || '.aiignore';
  if (writeResult.added.length === 0) {
    console.log(report.suggestedAiignore.length === 0
      ? 'Nothing to suggest for this directory.'
      : `${relative} already covers every suggestion.`);
  } else if (writeResult.dryRun) {
    console.log(`Would add ${writeResult.added.length} rule(s) to ${relative} (dry run, nothing written).`);
  } else if (writeResult.created) {
    console.log(`Created ${relative} with ${writeResult.added.length} rule(s).`);
  } else {
    console.log(`Added ${writeResult.added.length} rule(s) to ${relative}.`);
  }
}

console.log('');
console.log('Next step:');
if (writeResult && writeResult.written) {
  console.log('Commit .aiignore so your agent and your teammates share the same list.');
} else {
  console.log('Run this before asking your coding agent to inspect a larger repo.');
}
