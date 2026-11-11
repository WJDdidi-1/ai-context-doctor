// Type declarations for the CommonJS public entry point in lib/index.js.
// Keep this file in sync with module.exports there; test/types.test.js fails
// when a runtime export has no declaration.

export type NoiseCategory = 'build' | 'large' | 'lockfile' | 'log';

export type BlockedCategory = NoiseCategory | 'review' | 'other';

export type LevelNumber = 1 | 2 | 3 | 4 | 5;

export type LevelKey = 'off' | 'light' | 'balanced' | 'strong' | 'strict';

export type DimensionId = 'noise' | 'volume' | 'concentration' | 'sprawl' | 'binary';

export interface TokenEstimate {
  min: number;
  max: number;
}

export interface ScanOptions {
  maxFiles?: number;
  maxBytes?: number;
  rules?: Iterable<string> | null;
  level?: number | null;
}

export interface ScanLevelsOptions extends ScanOptions {
  levels?: number[];
}

export interface ClassificationLabel {
  label: string;
  reason: string;
}

export interface Classification {
  noise?: ClassificationLabel;
  review?: ClassificationLabel;
  suggestion: string | null;
}

export interface CategoryWeight {
  id: NoiseCategory;
  label: string;
  weight: number;
}

export interface ScoreNoiseInput {
  reason: string;
  bytes: number;
}

export interface ScoreBreakdown {
  id: NoiseCategory;
  label: string;
  weight: number;
  bytes: number;
  share: number;
  lost: number;
}

export interface ScoreNoiseResult {
  score: number;
  lost: number;
  breakdown: ScoreBreakdown[];
}

export interface ContextScoreInput {
  files?: number;
  bytes?: number;
  largestBytes?: number;
  binaryBytes?: number;
  noise?: ScoreNoiseInput[];
}

export interface Dimension {
  id: DimensionId;
  label: string;
  weight: number;
  hint: string;
}

export interface DimensionScore {
  id: DimensionId;
  label: string;
  hint: string;
  weight: number;
  lost: number;
  points: number;
  bytes: number;
  detail: ScoreBreakdown[] | null;
}

export interface ContextScoreResult {
  score: number;
  lost: number;
  breakdown: DimensionScore[];
}

export interface Level {
  level: LevelNumber;
  key: LevelKey;
  label: string;
  maxBytes: number;
  categories: NoiseCategory[];
  note: string;
}

export interface TopNoiseEntry {
  path: string;
  bytes: number;
  reason: string;
}

export interface ReviewEntry {
  path: string;
  reason: string;
}

export interface BlockedDetail {
  path: string;
  bytes: number;
  reason: string | null;
  category: BlockedCategory;
  rule: string | null;
  matchedRule: string | null;
  blockedBy: 'rule' | 'level';
  source: 'rule' | 'level';
  level: number | null;
  levelLabel: string | null;
  levelReason?: 'size' | 'category';
  limitBytes?: number;
}

export interface BlockedGroup {
  path: string;
  bytes: number;
  reason: string | null;
  rule: string | null;
  rules: string[];
  category: BlockedCategory | 'mixed';
  categories: BlockedCategory[];
  level: number | null;
  levelLabel: string | null;
  blockedBy: 'rule' | 'level' | 'mixed';
  source: 'rule' | 'level' | 'mixed';
  files: BlockedDetail[];
}

export interface Report {
  repo: string;
  scannedFiles: number;
  scannedBytes: number;
  healthScore: number;
  status: string;
  noisePercent: number;
  usefulPercent: number;
  topNoise: TopNoiseEntry[];
  scoreBreakdown: DimensionScore[];
  scoreLost: number;
  effectiveScore: number;
  effectiveScoreWithoutRules: number;
  rulesChangeTheScore: boolean;
  suggestedRulesChangeTheScore: boolean;
  effectiveBreakdown: DimensionScore[];
  effectiveLost: number;
  blockedBytes: number;
  blockedFiles: number;
  allowedBytes: number;
  allowedFiles: number;
  largestBytes: number;
  binaryBytes: number;
  blocked: BlockedGroup[];
  blockedDetails: BlockedDetail[];
  blockedReasons: BlockedDetail[];
  review: ReviewEntry[];
  suggestedAiignore: string[];
  tokenEstimate: {
    noise: TokenEstimate;
    useful: TokenEstimate;
  };
  truncated?: boolean;
}

export interface BlockDecision {
  source: 'aiignore' | 'strength';
  rule: string;
  description: string;
}

export interface FoundPathExplanation {
  found: true;
  path: string;
  absolutePath: string;
  size: number;
  truncated: boolean;
  verdict: 'blocked' | 'not blocked';
  blocked: boolean;
  category: NoiseCategory | null;
  reason: string | null;
  kind: 'noise' | 'review' | 'ordinary';
  rule: BlockDecision | null;
  scoreImpact: {
    healthScore: number;
    effectiveScore: number;
    effectiveScoreIfAllowed: number;
    points: number;
  };
  tokenEstimate: TokenEstimate;
}

export interface MissingPathExplanation {
  found: false;
  path: string;
  root: string;
  scannedFiles: number;
  truncated: boolean;
}

export type PathExplanation = FoundPathExplanation | MissingPathExplanation;

export interface AiignorePlan {
  added: string[];
  created: boolean;
}

export interface WriteAiignoreOptions {
  dryRun?: boolean;
}

export interface WriteAiignoreResult extends AiignorePlan {
  path: string;
  written: boolean;
  dryRun: boolean;
}

export function scanRepository(root: string, options?: ScanOptions): Report;

export function buildReport(root: string, options?: ScanOptions): Report;

export function scanLevels(
  root: string,
  options?: ScanLevelsOptions
): Array<{ level: number; report: Report }>;

export function classifyPath(relativePath: string, size?: number): Classification;

export function explainPath(
  root: string,
  targetPath?: string | null,
  options?: ScanOptions
): PathExplanation;

export function estimateTokens(bytes: number): TokenEstimate;

export function isSecretLikeFile(basename: string): boolean;

export function isTemplateFile(basename: string): boolean;

export function formatBytes(bytes: number): string;

export function statusFor(score: number): string;

export function scoreNoise(noise: ScoreNoiseInput[], totalBytes: number): ScoreNoiseResult;

export function noiseCategory(reason: string): NoiseCategory;

export const CATEGORY_WEIGHTS: CategoryWeight[];

export const LEVELS: Level[];

export const DEFAULT_LEVEL: number;

export function levelFor(level: number): Level;

export function levelBlocksCategory(level: Level, category: NoiseCategory): boolean;

export function contextScore(input?: ContextScoreInput): ContextScoreResult;

export const DIMENSIONS: Dimension[];

export function isBinaryPath(filePath: string): boolean;

export const POLICY_FILE: string;

export function readPolicy(cwd: string): LevelNumber;

export function writePolicy(cwd: string, level: number): Level;

export function writeAiignore(
  aiignorePath: string,
  suggested: Iterable<string>,
  options?: WriteAiignoreOptions
): WriteAiignoreResult;

export function planAiignore(input: {
  existing: string | null;
  suggested: Iterable<string>;
}): AiignorePlan;

export function matchesAiignore(
  rules: Iterable<string> | null | undefined,
  relativePath: string
): string | undefined;

export function parseRules(text: string): Set<string>;
