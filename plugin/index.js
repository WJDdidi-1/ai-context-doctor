import fs from 'node:fs';
import path from 'node:path';
import { scanRepository, classifyPath, estimateTokens } from 'ai-context-doctor';

/**
 * Values a user can override in cordis.patch.yml.
 * Kept as plain defaults so the plugin needs no schema dependency.
 */
const DEFAULTS = {
  // Inject only when the workspace is worse than this.
  healthThreshold: 80,
  // Scanning is a synchronous directory walk: cap it so opening a huge
  // monorepo cannot stall the Host.
  maxFiles: 20000,
  maxBytes: 256 * 1024 * 1024,
  // 'deny' refuses reads of generated output, lockfiles, logs and huge files;
  // 'off' only warns at session start. There is no middle setting on purpose:
  // a policy nobody can predict is worse than none.
  readPolicy: 'deny'
};

/**
 * The noise categories worth blocking. Templates and deployment scripts are
 * deliberately absent: they are small, and a wrong guess there loses real
 * information.
 */
const BLOCKED_REASONS = new Set([
  'generated build output',
  'test coverage output',
  'framework output',
  'framework cache',
  'lockfile',
  'local log file',
  'large file'
]);

/** Per-workspace record of what was skipped, so a UI can show it later. */
const readLog = new Map();

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokens(range) {
  const min = range.min.toLocaleString('en-US');
  const max = range.max.toLocaleString('en-US');
  return min === max ? `~${min}` : `~${min}–${max}`;
}

function recordSkip(cwd, relativePath, size, reason) {
  let entry = readLog.get(cwd);
  if (entry === undefined) {
    entry = new Map();
    readLog.set(cwd, entry);
  }
  const existing = entry.get(relativePath);
  if (existing === undefined) {
    entry.set(relativePath, { path: relativePath, bytes: size, reason, attempts: 1 });
  } else {
    existing.attempts += 1;
  }
}

/**
 * Reads the plugin refused, grouped by workspace. Exported for tests and for
 * the UI half that lists what this session did not read.
 *
 * @param {string} [cwd]
 * @returns {Array<{ path: string, bytes: number, reason: string, attempts: number }>}
 */
export function getSkippedReads(cwd) {
  const entry = readLog.get(cwd);
  if (entry === undefined) return [];
  return [...entry.values()].map((item) => ({ ...item }));
}

/** Test seam: forget everything recorded so far. */
export function resetSkipLog() {
  readLog.clear();
}

/**
 * Decide whether one read should be refused.
 *
 * Pure apart from the `stat` it needs for the size rule, so it can be tested
 * without a running Harness.
 *
 * @param {{ root: string, filePath: string, policy?: string }} input
 * @returns {{ block: false } | { block: true, relativePath: string, bytes: number, reason: string, tokens: { min: number, max: number } }}
 */
export function decideRead({ root, filePath, policy = 'deny' }) {
  if (policy !== 'deny') return { block: false };
  if (typeof root !== 'string' || typeof filePath !== 'string') return { block: false };

  const absolute = path.resolve(root, filePath);
  const relative = path.relative(root, absolute);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    // Outside the workspace: not ours to judge.
    return { block: false };
  }

  let size = 0;
  try {
    const stats = fs.statSync(absolute);
    if (!stats.isFile()) return { block: false };
    size = stats.size;
  } catch {
    // Missing file: let the read tool report that in its own words.
    return { block: false };
  }

  const normalized = relative.split(path.sep).join('/');
  const classified = classifyPath(normalized, size);
  if (classified.noise === undefined || !BLOCKED_REASONS.has(classified.noise.reason)) {
    return { block: false };
  }

  return {
    block: true,
    relativePath: normalized,
    bytes: size,
    reason: classified.noise.reason,
    tokens: estimateTokens(size)
  };
}

/**
 * The line the model sees instead of the file. It has to say three things:
 * what was skipped, how much context that saves, and what to do about it.
 *
 * @param {{ relativePath: string, bytes: number, reason: string, tokens: { min: number, max: number } }} decision
 * @returns {string}
 */
export function formatDenial(decision) {
  return [
    `[ai-context-doctor] Skipped ${decision.relativePath} (${formatBytes(decision.bytes)}, ${decision.reason}).`,
    `Reading it would have added ${formatTokens(decision.tokens)} tokens of context this task probably does not need.`,
    'Tell the user the file was skipped and why. If the content matters, ask them to paste the relevant part or turn the plugin read policy off.'
  ].join(' ');
}

/**
 * Render the note the agent reads. Short on purpose: it competes with the
 * user's own instructions for the model's attention.
 *
 * @param {ReturnType<typeof scanRepository>} report
 * @returns {string}
 */
export function formatNotice(report) {
  // Older callers may pass a report from before tokenEstimate existed.
  const noiseTokens = report.tokenEstimate && report.tokenEstimate.noise
    ? ` (${formatTokens(report.tokenEstimate.noise)} tokens)`
    : '';
  const lines = [
    `[ai-context-doctor] This workspace scores ${report.healthScore}/100 for context health: ${report.noisePercent}% of ${formatBytes(report.scannedBytes)} in ${report.scannedFiles} files is likely noise${noiseTokens}.`
  ];

  const top = report.topNoise.slice(0, 3);
  if (top.length > 0) {
    const detail = top.map((item) => `${item.path} (${formatBytes(item.bytes)}, ${item.reason})`).join(', ');
    lines.push(`Biggest offenders: ${detail}.`);
  }

  if (report.suggestedAiignore.length > 0) {
    lines.push(`Suggested .aiignore: ${report.suggestedAiignore.join(', ')}.`);
  }

  lines.push('Do not read those files unless the task needs them; ask before opening large generated files.');
  return lines.join('\n');
}

/**
 * Host half of the bundle. Fires once per workspace when a session starts an
 * agent, so the warning arrives before the agent reads anything, and installs
 * a guard that refuses reads of the same files the warning names.
 *
 * @param {any} ctx Plugin context.
 * @param {{ healthThreshold?: number, maxFiles?: number, maxBytes?: number, readPolicy?: string }} [config]
 */
export function apply(ctx, config = {}) {
  const options = { ...DEFAULTS, ...config };
  const inspected = new Set();

  const guard = (exec) => {
    try {
      if (options.readPolicy !== 'deny') return undefined;
      if (exec === null || typeof exec !== 'object') return undefined;
      // Only the file-read tool carries a path we can judge.
      if (exec.name !== 'read') return undefined;

      const args = exec.arguments !== null && typeof exec.arguments === 'object' ? exec.arguments : {};
      const filePath = typeof args.file_path === 'string' ? args.file_path : args.path;
      if (typeof filePath !== 'string' || filePath.length === 0) return undefined;

      const session = exec.agent !== null && exec.agent !== undefined ? exec.agent.session : undefined;
      const cwd = session !== null && session !== undefined && session.meta !== undefined ? session.meta.cwd : undefined;
      if (typeof cwd !== 'string' || cwd.length === 0) return undefined;

      const decision = decideRead({ root: cwd, filePath, policy: options.readPolicy });
      if (decision.block !== true) return undefined;

      recordSkip(cwd, decision.relativePath, decision.bytes, decision.reason);
      return formatDenial(decision);
    } catch {
      // A guard that throws would break every tool call in the session.
      return undefined;
    }
  };

  let guardInstalled = false;
  const installGuard = () => {
    if (guardInstalled) return;
    try {
      if (ctx.tools !== null && ctx.tools !== undefined && typeof ctx.tools.guard === 'function') {
        ctx.tools.guard(guard);
        guardInstalled = true;
      }
    } catch {
      // Tool registry not mounted in this profile: warnings only.
    }
  };

  installGuard();

  ctx.on('agent/created', (payload) => {
    try {
      // The registry may mount after this plugin; retry here, where it exists.
      installGuard();

      const agent = payload && payload.agent ? payload.agent : payload;
      const cwd = agent && agent.session && agent.session.meta && agent.session.meta.cwd;
      if (typeof cwd !== 'string' || cwd.length === 0) return;
      if (inspected.has(cwd)) return;

      const report = scanRepository(cwd, {
        maxFiles: options.maxFiles,
        maxBytes: options.maxBytes
      });

      inspected.add(cwd);

      if (report.healthScore >= options.healthThreshold) return;
      if (typeof agent.inject !== 'function') return;

      agent.inject({
        content: [{ type: 'text', text: formatNotice(report) }],
        source: { kind: 'ai-context-doctor' }
      });
    } catch {
      // A plugin must never break the session it observes.
    }
  });
}
