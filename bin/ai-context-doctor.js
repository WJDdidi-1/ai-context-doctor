#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const repoName = path.basename(cwd);
const noise = new Map();
const review = new Map();
const suggestions = new Set();
let totalFiles = 0;
let totalBytes = 0;

const ignoredDirs = new Set(['.git', 'node_modules']);

const noiseDirs = new Map([
  ['dist', 'generated build output'],
  ['build', 'generated build output'],
  ['coverage', 'test coverage output'],
  ['.next', 'framework output'],
  ['.turbo', 'framework cache']
]);

const lockfiles = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock'
]);

function walk(dir) {
  let entries = [];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(cwd, absolutePath) || entry.name;

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      walk(absolutePath);
      continue;
    }

    if (!entry.isFile()) continue;

    let stats;
    try {
      stats = fs.statSync(absolutePath);
    } catch {
      continue;
    }

    totalFiles += 1;
    totalBytes += stats.size;
    classify(relativePath, stats.size);
  }
}

function classify(relativePath, size) {
  const normalized = relativePath.split(path.sep).join('/');
  const parts = normalized.split('/');
  const basename = parts[parts.length - 1];

  for (const part of parts.slice(0, -1)) {
    if (noiseDirs.has(part)) {
      const label = `${part}/`;
      addNoise(label, size, noiseDirs.get(part));
      suggestions.add(label);
      return;
    }
  }

  if (lockfiles.has(basename)) {
    addNoise(normalized, size, 'lockfile');
    suggestions.add('*.lock');
    return;
  }

  if (basename.endsWith('.log')) {
    addNoise(normalized, size, 'local log file');
    suggestions.add('*.log');
    return;
  }

  if (basename.startsWith('.env')) {
    addReview(normalized, 'environment-like file');
    suggestions.add('.env*');
  }

  if (/deploy/i.test(normalized)) {
    addReview(normalized, 'deployment script');
  }
}

function addNoise(label, size, reason) {
  const item = noise.get(label) || { size: 0, reason };
  item.size += size;
  noise.set(label, item);
}

function addReview(label, reason) {
  if (!review.has(label)) {
    review.set(label, reason);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function statusFor(score) {
  if (score >= 85) return 'Looks clean for an AI coding agent';
  if (score >= 60) return 'Some context noise found';
  return 'Too much noise for an AI coding agent';
}

function printTable(items, emptyMessage) {
  if (items.length === 0) {
    console.log(emptyMessage);
    return;
  }

  items.forEach(([label, item], index) => {
    const name = `${index + 1}. ${label}`.padEnd(28);
    const size = formatBytes(item.size).padStart(9);
    console.log(`${name} ${size}   ${item.reason}`);
  });
}

walk(cwd);

const noiseBytes = [...noise.values()].reduce((sum, item) => sum + item.size, 0);
const noisePercent = totalBytes === 0 ? 0 : Math.round((noiseBytes / totalBytes) * 100);
const usefulPercent = Math.max(0, 100 - noisePercent);
const healthScore = Math.max(0, Math.min(100, 100 - noisePercent));
const topNoise = [...noise.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5);

console.log('AI Context Doctor');
console.log('');
console.log(`Repo: ${repoName}`);
console.log(`Scanned: ${totalFiles} files, ${formatBytes(totalBytes)}`);
console.log('');
console.log(`AI Context Health: ${healthScore}/100`);
console.log(`Status: ${statusFor(healthScore)}`);
console.log('');
console.log('Context noise estimate:');
console.log(`${noisePercent}% likely noise`);
console.log(`${usefulPercent}% likely useful source context`);
console.log('');
console.log('Top context waste:');
printTable(topNoise, 'No obvious context waste found.');
console.log('');
console.log('Review before sharing:');
if (review.size === 0) {
  console.log('No environment-like files or deployment scripts found.');
} else {
  for (const [label, reason] of review.entries()) {
    console.log(`- ${label.padEnd(24)} ${reason}`);
  }
}
console.log('');
console.log('Suggested .aiignore:');
if (suggestions.size === 0) {
  console.log('No suggestions yet.');
} else {
  for (const suggestion of suggestions) {
    console.log(suggestion);
  }
}
console.log('');
console.log('Next step:');
console.log('Run this before asking your coding agent to inspect a larger repo.');
