'use strict';

const fs = require('fs');
const path = require('path');
const { isSecretLikeFile, isTemplateFile, noiseCategory, statusFor } = require('./rules');
const { contextScore, isBinaryPath } = require('./score');
const { levelFor, levelBlocksCategory } = require('./levels');
const { matchesAiignore } = require('./aiignore');

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

// Measured on this repository (docs/research/token-estimation.md): one token
// covers between 3.08 and 4.32 bytes of source. Convert with the range instead
// of inventing a single precise number.
const bytesPerTokenMin = 3.08;
const bytesPerTokenMax = 4.32;

/**
 * Estimate the token range a byte count represents.
 *
 * @param {number} bytes
 * @returns {{ min: number, max: number }}
 */
function estimateTokens(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return { min: 0, max: 0 };
  return {
    min: Math.round(bytes / bytesPerTokenMax),
    max: Math.round(bytes / bytesPerTokenMin)
  };
}

/**
 * Classify one path without touching the filesystem.
 *
 * The CLI report and the Harness plugin must agree on what counts as noise,
 * so both call this single function rather than keeping parallel rule lists.
 *
 * @param {string} relativePath Path relative to the scanned root.
 * @param {number} [size] File size in bytes; 0 skips the large-file rule.
 * @returns {{ noise?: { label: string, reason: string }, review?: { label: string, reason: string }, suggestion: string | null }}
 */
function classifyPath(relativePath, size = 0) {
  const normalized = relativePath.split(path.sep).join('/');
  const parts = normalized.split('/');
  const basename = parts[parts.length - 1];

  for (const part of parts.slice(0, -1)) {
    if (noiseDirs.has(part)) {
      const label = `${part}/`;
      return { noise: { label, reason: noiseDirs.get(part) }, suggestion: label };
    }
  }

  if (lockfiles.has(basename)) {
    // Suggest the exact filename: `*.lock` would miss package-lock.json.
    return { noise: { label: normalized, reason: 'lockfile' }, suggestion: basename };
  }

  if (basename.endsWith('.log')) {
    return { noise: { label: normalized, reason: 'local log file' }, suggestion: '*.log' };
  }

  if (size > largeFileThresholdBytes) {
    return { noise: { label: normalized, reason: 'large file' }, suggestion: null };
  }

  if (isTemplateFile(basename)) {
    // Templates like .env.example are meant to be shared; note them, don't alarm.
    return { review: { label: normalized, reason: 'environment template (usually safe to share)' }, suggestion: null };
  }

  if (isSecretLikeFile(basename)) {
    return {
      review: { label: normalized, reason: 'environment-like file' },
      suggestion: basename.startsWith('.env') ? '.env*' : basename
    };
  }

  if (/deploy/i.test(normalized)) {
    return { review: { label: normalized, reason: 'deployment script' }, suggestion: null };
  }

  return { suggestion: null };
}

/**
 * Scan a directory and describe how much of it is context noise.
 *
 * Synchronous and dependency-free on purpose: the CLI, the tests, and other
 * callers all run it in-process. Callers that cannot afford a full walk pass
 * `maxFiles` / `maxBytes` and get `truncated: true` back.
 *
 * @param {string} root Directory to scan.
 * @param {{ maxFiles?: number, maxBytes?: number, rules?: string[], level?: number }} [options]
 *   `rules` and `level` describe what the agent will *not* be handed: matching
 *   files still count towards the totals and the raw score, but they are left
 *   out of `effectiveScore`, which is what the guard actually lets through.
 * @returns {object} Report with `repo`, counts, `healthScore`, `topNoise`,
 *   `review`, and `suggestedAiignore`.
 */
/**
 * One walk, no scoring: the file list every report is built from.
 *
 * Level previews used to walk the tree once per strength, which made the panel
 * read the same directory five times. Collecting first lets `scanLevels` share
 * a single walk and still answer for every strength.
 *
 * @param {string} root Directory to scan.
 * @param {{ maxFiles?: number, maxBytes?: number }} [options]
 * @returns {{ entries: Array<{ relativePath: string, size: number, binary: boolean }>,
 *   totalFiles: number, totalBytes: number, largestBytes: number, binaryBytes: number,
 *   truncated: boolean }}
 */
function collectFiles(root, options = {}) {
  const maxFiles = Number.isFinite(options.maxFiles) ? options.maxFiles : Infinity;
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : Infinity;

  const entries = [];
  let totalFiles = 0;
  let totalBytes = 0;
  let largestBytes = 0;
  let binaryBytes = 0;
  let truncated = false;

  const walk = (dir) => {
    if (truncated) return;

    let children = [];
    try {
      children = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of children) {
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
      if (stats.size > largestBytes) largestBytes = stats.size;
      const binary = isBinaryPath(relativePath);
      if (binary) binaryBytes += stats.size;

      entries.push({ relativePath, size: stats.size, binary });
    }
  };

  walk(root);

  return { entries, totalFiles, totalBytes, largestBytes, binaryBytes, truncated };
}

/**
 * Would this path reach the model anyway? Two ways out: a rule the user wrote,
 * or the strength they chose. The raw score ignores both; the effective score
 * is exactly this question, which is why moving the strength or optimising
 * moves the number.
 */
function isBlockedBy(relativePath, size, reason, rules, level) {
  if (rules.length > 0 && matchesAiignore(rules, relativePath) !== null) return true;
  if (level === null) return false;
  // The size limit applies to anything, exactly like the guard: a level that
  // says "nothing over 1 MB" has to mean it.
  if (size > level.maxBytes) return true;
  return levelBlocksCategory(level, noiseCategory(reason)) === true;
}

/**
 * Turn one collected walk into one report for one strength.
 */
function buildReportFrom(root, collected, options = {}) {
  const rules = Array.isArray(options.rules) ? options.rules : [];
  const level = options.level === undefined || options.level === null ? null : levelFor(options.level);

  const noise = new Map();
  const review = new Map();
  const suggestions = new Set();
  const allowed = { files: 0, bytes: 0, largestBytes: 0, binaryBytes: 0 };

  for (const entry of collected.entries) {
    const classification = classifyPath(entry.relativePath, entry.size);
    const reason = classification.noise === undefined ? null : classification.noise.reason;
    const blocked = isBlockedBy(entry.relativePath, entry.size, reason, rules, level);

    if (blocked !== true) {
      allowed.files += 1;
      allowed.bytes += entry.size;
      if (entry.size > allowed.largestBytes) allowed.largestBytes = entry.size;
      if (entry.binary === true) allowed.binaryBytes += entry.size;
    }

    if (classification.noise !== undefined) {
      const label = classification.noise.label;
      const item = noise.get(label) || { size: 0, reason: classification.noise.reason, blocked: true };
      item.size += entry.size;
      // A label is only "already handled" when every byte under it is.
      item.blocked = item.blocked === true && blocked === true;
      noise.set(label, item);
    }
    if (classification.review !== undefined) {
      if (!review.has(classification.review.label)) {
        review.set(classification.review.label, classification.review.reason);
      }
    }
    if (classification.suggestion) {
      suggestions.add(classification.suggestion);
    }
  }

  const { totalFiles, totalBytes, largestBytes, binaryBytes, truncated } = collected;

  const noiseEntries = [...noise.entries()].map(([label, item]) => ({
    path: label,
    reason: item.reason,
    bytes: item.size,
    blocked: item.blocked === true
  }));
  const noiseBytes = noiseEntries.reduce((sum, item) => sum + item.bytes, 0);
  const noisePercent = totalBytes === 0 ? 0 : Math.round((noiseBytes / totalBytes) * 100);
  const usefulPercent = Math.max(0, 100 - noisePercent);

  const scored = contextScore({
    files: totalFiles,
    bytes: totalBytes,
    largestBytes,
    binaryBytes,
    noise: noiseEntries
  });
  const healthScore = scored.score;

  const blockedEntries = noiseEntries.filter((item) => item.blocked === true);
  const effective = contextScore({
    files: allowed.files,
    bytes: allowed.bytes,
    largestBytes: allowed.largestBytes,
    binaryBytes: allowed.binaryBytes,
    noise: noiseEntries.filter((item) => item.blocked !== true)
  });
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
    scoreBreakdown: scored.breakdown,
    scoreLost: scored.lost,
    effectiveScore: effective.score,
    effectiveBreakdown: effective.breakdown,
    effectiveLost: effective.lost,
    blockedBytes: blockedEntries.reduce((sum, item) => sum + item.bytes, 0),
    blockedFiles: totalFiles - allowed.files,
    allowedBytes: allowed.bytes,
    allowedFiles: allowed.files,
    largestBytes,
    binaryBytes,
    blocked: blockedEntries.slice(0, 5).map((item) => ({
      path: item.path,
      bytes: item.bytes,
      reason: item.reason
    })),
    review: [...review.entries()].map(([label, reason]) => ({ path: label, reason })),
    suggestedAiignore: [...suggestions],
    tokenEstimate: {
      noise: estimateTokens(noiseBytes),
      useful: estimateTokens(Math.max(0, totalBytes - noiseBytes))
    }
  };

  if (truncated) {
    report.truncated = true;
  }

  return report;
}

function scanRepository(root, options = {}) {
  const collected = collectFiles(root, options);
  return buildReportFrom(root, collected, options);
}

/**
 * The same report for several strengths, from **one** directory walk.
 *
 * The panel shows what each strength would let through, and walking the tree
 * once per strength meant reading every file five times for one screen.
 *
 * @param {string} root Directory to scan.
 * @param {{ maxFiles?: number, maxBytes?: number, rules?: string[], levels: number[] }} options
 * @returns {Array<{ level: number, report: object }>}
 */
function scanLevels(root, options = {}) {
  const levels = Array.isArray(options.levels) ? options.levels : [];
  const collected = collectFiles(root, options);
  return levels.map((level) => ({
    level,
    report: buildReportFrom(root, collected, { ...options, level })
  }));
}

module.exports = { scanRepository, scanLevels, collectFiles, classifyPath, estimateTokens };
