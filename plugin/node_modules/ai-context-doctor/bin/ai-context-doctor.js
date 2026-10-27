#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const packageInfo = require('../package.json');
const { scanRepository, formatBytes, statusFor } = require('../lib');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const positional = args.filter((arg) => arg !== '--json');
const firstArg = positional[0];

if (firstArg === '--help') {
  printHelp();
  process.exit(0);
}

if (firstArg === '--version') {
  console.log(packageInfo.version);
  process.exit(0);
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
  console.log('');
  console.log('Examples:');
  console.log('  node bin/ai-context-doctor.js');
  console.log('  node bin/ai-context-doctor.js ../some-repo');
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

const report = scanRepository(cwd);

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
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
console.log('');
console.log('Next step:');
console.log('Run this before asking your coding agent to inspect a larger repo.');
