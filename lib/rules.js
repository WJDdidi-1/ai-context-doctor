'use strict';

// Pure helpers for the context-noise report. No I/O and no module-level state,
// so they can be unit tested directly.

// Matches names like `.env`, `.env.production`, `secrets.env`, `credentials.json`.
const secretLikePattern = /(^\.env(\..+)?$)|(\.env$)|(^credentials(\..+)?$)|(^secrets?(\..+)?$)|(\.pem$)|(\.key$)/i;
const templatePattern = /\.(example|sample|template|dist)$/i;

function isSecretLikeFile(basename) {
  return secretLikePattern.test(basename);
}

function isTemplateFile(basename) {
  return templatePattern.test(basename);
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

/**
 * The score is a sum of four independent losses, not one byte ratio.
 *
 * A single 40 MB build directory used to drag a repository to 2/100 even though
 * the only fix is one line in .aiignore. Weighting the categories separately
 * keeps every loss explainable ("build output costs at most 40 points") and
 * stops one pathological file from speaking for the whole repository.
 */
const CATEGORY_WEIGHTS = [
  { id: 'build', label: 'build output', weight: 40 },
  { id: 'large', label: 'large files', weight: 25 },
  { id: 'lockfile', label: 'lockfiles', weight: 20 },
  { id: 'log', label: 'logs', weight: 15 }
];

/**
 * Map a rule reason onto the category it costs points in.
 *
 * @param {string} reason Reason recorded by classifyPath.
 * @returns {'build' | 'large' | 'lockfile' | 'log'}
 */
function noiseCategory(reason) {
  if (reason === 'lockfile') return 'lockfile';
  if (reason === 'local log file') return 'log';
  if (reason === 'generated build output' || reason === 'test coverage output' || reason === 'framework output' || reason === 'framework cache') return 'build';
  return 'large';
}

/**
 * Turn classified noise into a 0-100 score with its arithmetic exposed.
 *
 * @param {Array<{ reason: string, bytes: number }>} noise
 * @param {number} totalBytes
 * @returns {{ score: number, lost: number, breakdown: Array<object> }}
 */
function scoreNoise(noise, totalBytes) {
  const bytesByCategory = new Map();
  for (const item of noise) {
    const id = noiseCategory(item.reason);
    bytesByCategory.set(id, (bytesByCategory.get(id) || 0) + item.bytes);
  }

  const breakdown = CATEGORY_WEIGHTS.map(({ id, label, weight }) => {
    const bytes = bytesByCategory.get(id) || 0;
    const share = totalBytes > 0 ? bytes / totalBytes : 0;
    // A category can never cost more than its weight, however dominant it is.
    const lost = Math.min(weight, weight * share);
    return {
      id,
      label,
      weight,
      bytes,
      share: Math.round(share * 1000) / 10,
      lost: Math.round(lost * 10) / 10
    };
  });

  const lost = Math.round(breakdown.reduce((sum, item) => sum + item.lost, 0) * 10) / 10;
  return { score: Math.max(0, Math.min(100, Math.round(100 - lost))), lost, breakdown };
}

function statusFor(score) {
  if (score >= 85) return 'Looks clean for an AI coding agent';
  if (score >= 60) return 'Some context noise found';
  return 'Too much noise for an AI coding agent';
}

module.exports = {
  CATEGORY_WEIGHTS,
  noiseCategory,
  scoreNoise,
  isSecretLikeFile,
  isTemplateFile,
  formatBytes,
  statusFor
};
