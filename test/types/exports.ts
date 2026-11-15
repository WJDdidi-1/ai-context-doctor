// Compile-only fixture: every value and type the package exports must resolve
// through package.json's "exports" map. `npm test` runs tsc over this file.
import {
  CATEGORY_WEIGHTS,
  DEFAULT_LEVEL,
  DIMENSIONS,
  LEVELS,
  POLICY_FILE,
  buildReport,
  classifyPath,
  contextScore,
  estimateTokens,
  explainPath,
  formatBytes,
  isBinaryPath,
  isSecretLikeFile,
  isTemplateFile,
  levelBlocksCategory,
  levelFor,
  matchesAiignore,
  noiseCategory,
  parseRules,
  planAiignore,
  readPolicy,
  scanLevels,
  scanRepository,
  scoreNoise,
  statusFor,
  writeAiignore,
  writePolicy
} from 'ai-context-doctor';
import type {
  Classification,
  ContextScoreResult,
  PathExplanation,
  Report,
  ScanOptions,
  ScoreNoiseResult,
  TokenEstimate,
  WriteAiignoreResult
} from 'ai-context-doctor';

const options: ScanOptions = {
  maxFiles: 10,
  maxBytes: 1024,
  rules: new Set(['dist/']),
  level: 3
};
const report: Report = scanRepository('.', options);
const built: Report = buildReport('.', options);
const levels: Array<{ level: number; report: Report }> = scanLevels('.', {
  ...options,
  levels: [1, 3, 5]
});
const classification: Classification = classifyPath('dist/app.js', 10);
const explanation: PathExplanation = explainPath('.', 'src/index.js', options);
const tokens: TokenEstimate = estimateTokens(report.scannedBytes);
const noise: ScoreNoiseResult = scoreNoise([{ reason: 'lockfile', bytes: 10 }], 100);
const context: ContextScoreResult = contextScore({
  files: 1,
  bytes: 10,
  noise: [{ reason: 'lockfile', bytes: 5 }]
});
const written: WriteAiignoreResult = writeAiignore('.aiignore', report.suggestedAiignore, { dryRun: true });
const plan = planAiignore({ existing: null, suggested: ['dist/'] });
const rules: Set<string> = parseRules('dist/\n*.log\n');

export const publicApi = {
  CATEGORY_WEIGHTS,
  DEFAULT_LEVEL,
  DIMENSIONS,
  LEVELS,
  POLICY_FILE,
  buildReport,
  classifyPath,
  contextScore,
  estimateTokens,
  explainPath,
  formatBytes,
  isBinaryPath,
  isSecretLikeFile,
  isTemplateFile,
  levelBlocksCategory,
  levelFor,
  matchesAiignore,
  noiseCategory,
  parseRules,
  planAiignore,
  readPolicy,
  scanLevels,
  scanRepository,
  scoreNoise,
  statusFor,
  writeAiignore,
  writePolicy,
  report,
  built,
  levels,
  classification,
  explanation,
  tokens,
  noise,
  context,
  written,
  plan,
  rules,
  match: matchesAiignore(rules, 'dist/app.js'),
  level: levelFor(DEFAULT_LEVEL),
  blocks: LEVELS.length > 0 ? levelBlocksCategory(LEVELS[0], 'build') : false,
  category: noiseCategory('lockfile'),
  status: statusFor(100),
  binary: isBinaryPath('a.png'),
  secret: isSecretLikeFile('.env'),
  template: isTemplateFile('.env.example'),
  bytes: formatBytes(1024),
  policy: readPolicy('.'),
  wrote: writePolicy('.', 3)
};
