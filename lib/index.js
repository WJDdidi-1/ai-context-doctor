'use strict';

// Public entry point for programmatic callers (other tools, agents, tests).
// The CLI in bin/ is a thin printer on top of these.
const { scanRepository } = require('./scan');
const { isSecretLikeFile, isTemplateFile, formatBytes, statusFor } = require('./rules');
const { writeAiignore, planAiignore } = require('./aiignore');

module.exports = {
  scanRepository,
  isSecretLikeFile,
  isTemplateFile,
  formatBytes,
  statusFor,
  writeAiignore,
  planAiignore
};
