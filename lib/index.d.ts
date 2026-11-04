export interface ScanOptions {
  cwd?: string;
  level?: string;
  maxFiles?: number;
}

export function scanRepository(dir?: string, options?: ScanOptions): Promise<any>;
export function scanLevels(dir?: string, options?: ScanOptions): Promise<any>;
export function classifyPath(filePath: string): any;
export function estimateTokens(content: string): number;
export function isSecretLikeFile(filePath: string): boolean;
export function isTemplateFile(filePath: string): boolean;
export function formatBytes(bytes: number): string;
export function statusFor(item: any): string;
export function writeAiignore(dir: string, rules: string[]): Promise<void>;
export function planAiignore(dir: string, options?: any): Promise<any>;
export function matchesAiignore(filePath: string, rules: string[]): boolean;
export function parseRules(content: string): string[];
export function scoreNoise(file: any): number;
export function noiseCategory(file: any): string;
export const CATEGORY_WEIGHTS: Record<string, number>;
export const LEVELS: Record<string, any>;
export const DEFAULT_LEVEL: string;
export function levelFor(name: string): any;
export function levelBlocksCategory(level: string, category: string): boolean;
export function contextScore(stats: any): any;
export const DIMENSIONS: Record<string, any>;
export function isBinaryPath(filePath: string): boolean;
export const POLICY_FILE: string;
export function readPolicy(dir?: string): any;
export function writePolicy(dir: string, policy: any): void;
