'use strict';

// Public entry point for programmatic callers (other tools, agents, tests).
// The CLI in bin/ is a thin printer on top of these.
const { scanRepository, classifyPath, estimateTokens } = require('./scan');
const { isSecretLikeFile, isTemplateFile, formatBytes, statusFor } = require('./rules');
const { writeAiignore, planAiignore, matchesAiignore, parseRules } = require('./aiignore');

module.exports = {
  scanRepository,
  classifyPath,
  estimateTokens,
  isSecretLikeFile,
  isTemplateFile,
  formatBytes,
  statusFor,
  writeAiignore,
  planAiignore,
  matchesAiignore,
  parseRules
};
