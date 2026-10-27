'use strict';

const fs = require('fs');
const path = require('path');
const { isSecretLikeFile, isTemplateFile, statusFor } = require('./rules');

const ignoredDirs = new Set([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  'vendor'
]);

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

const largeFileThresholdBytes = 1024 * 1024;

/**
 * Scan a directory and describe how much of it is context noise.
 *
 * Synchronous and dependency-free on purpose: the CLI, the tests, and other
 * callers all run it in-process. Callers that cannot afford a full walk pass
 * `maxFiles` / `maxBytes` and get `truncated: true` back.
 *
 * @param {string} root Directory to scan.
 * @param {{ maxFiles?: number, maxBytes?: number }} [options]
 * @returns {object} Report with `repo`, counts, `healthScore`, `topNoise`,
 *   `review`, and `suggestedAiignore`.
 */
function scanRepository(root, options = {}) {
  const maxFiles = Number.isFinite(options.maxFiles) ? options.maxFiles : Infinity;
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : Infinity;

  const noise = new Map();
  const review = new Map();
  const suggestions = new Set();
  let totalFiles = 0;
  let totalBytes = 0;
  let truncated = false;

  const addNoise = (label, size, reason) => {
    const item = noise.get(label) || { size: 0, reason };
    item.size += size;
    noise.set(label, item);
  };

  const addReview = (label, reason) => {
    if (!review.has(label)) {
      review.set(label, reason);
    }
  };

  const classify = (relativePath, size) => {
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
      // Suggest the exact filename: `*.lock` would miss package-lock.json.
      suggestions.add(basename);
      return;
    }

    if (basename.endsWith('.log')) {
      addNoise(normalized, size, 'local log file');
      suggestions.add('*.log');
      return;
    }

    if (size > largeFileThresholdBytes) {
      addNoise(normalized, size, 'large file');
      return;
    }

    if (isTemplateFile(basename)) {
      // Templates like .env.example are meant to be shared; note them, don't alarm.
      addReview(normalized, 'environment template (usually safe to share)');
    } else if (isSecretLikeFile(basename)) {
      addReview(normalized, 'environment-like file');
      suggestions.add(basename.startsWith('.env') ? '.env*' : basename);
    }

    if (/deploy/i.test(normalized)) {
      addReview(normalized, 'deployment script');
    }
  };

  const walk = (dir) => {
    if (truncated) return;

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (truncated) return;

      const absolutePath = path.join(dir, entry.name);
      const relativePath = path.relative(root, absolutePath) || entry.name;

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

      if (totalFiles + 1 > maxFiles || totalBytes + stats.size > maxBytes) {
        truncated = true;
        return;
      }

      totalFiles += 1;
      totalBytes += stats.size;
      classify(relativePath, stats.size);
    }
  };

  walk(root);

  const noiseBytes = [...noise.values()].reduce((sum, item) => sum + item.size, 0);
  const noisePercent = totalBytes === 0 ? 0 : Math.round((noiseBytes / totalBytes) * 100);
  const usefulPercent = Math.max(0, 100 - noisePercent);
  const healthScore = Math.max(0, Math.min(100, 100 - noisePercent));
  const topNoise = [...noise.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5);

  const report = {
    repo: path.basename(root),
    scannedFiles: totalFiles,
    scannedBytes: totalBytes,
    healthScore,
    status: statusFor(healthScore),
    noisePercent,
    usefulPercent,
    topNoise: topNoise.map(([label, item]) => ({
      path: label,
      bytes: item.size,
      reason: item.reason
    })),
    review: [...review.entries()].map(([label, reason]) => ({ path: label, reason })),
    suggestedAiignore: [...suggestions]
  };

  if (truncated) {
    report.truncated = true;
  }

  return report;
}

module.exports = { scanRepository };
