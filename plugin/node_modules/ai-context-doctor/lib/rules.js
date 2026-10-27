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

function statusFor(score) {
  if (score >= 85) return 'Looks clean for an AI coding agent';
  if (score >= 60) return 'Some context noise found';
  return 'Too much noise for an AI coding agent';
}

module.exports = {
  isSecretLikeFile,
  isTemplateFile,
  formatBytes,
  statusFor
};
