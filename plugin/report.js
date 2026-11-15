import { estimateTokens } from 'ai-context-doctor';

/**
 * Per-workspace state the UI reads.
 *
 * Kept apart from the plugin wiring so it can be tested without a Host: every
 * function here is plain data in, plain data out.
 */
export function createWorkspaceState() {
  return {
    report: undefined,
    skipped: new Map(),
    reads: new Map(),
    writes: new Map(),
    allowed: new Set()
  };
}

/**
 * Record a refused read.
 *
 * @param {ReturnType<typeof createWorkspaceState>} state
 * @param {{ relativePath: string, bytes: number, reason: string }} decision
 */
export function recordSkip(state, decision) {
  const existing = state.skipped.get(decision.relativePath);
  if (existing === undefined) {
    state.skipped.set(decision.relativePath, {
      path: decision.relativePath,
      bytes: decision.bytes,
      reason: decision.reason,
      attempts: 1
    });
    return;
  }
  existing.attempts += 1;
}

/**
 * Record a read that was let through. `verdict` is how the classifier saw it:
 * 'useful' for source, 'review' for templates and deploy scripts, and
 * 'allowed' when the user overrode the guard.
 *
 * @param {ReturnType<typeof createWorkspaceState>} state
 * @param {{ relativePath: string, bytes: number, verdict: string }} entry
 */
export function recordRead(state, entry) {
  const existing = state.reads.get(entry.relativePath);
  if (existing === undefined) {
    state.reads.set(entry.relativePath, {
      path: entry.relativePath,
      bytes: entry.bytes,
      verdict: entry.verdict,
      attempts: 1
    });
    return;
  }
  existing.attempts += 1;
}

/**
 * Allow a path the file manager points at, whether or not it was ever blocked.
 * The guard consults this before it classifies anything, so a listing row can
 * pre-approve a file the session has not tried yet.
 *
 * @param {ReturnType<typeof createWorkspaceState>} state
 * @param {string} relativePath
 */
export function allowAnyPath(state, relativePath) {
  state.allowed.add(relativePath);
  state.skipped.delete(relativePath);
}

/**
 * Allow one path for this workspace, dropping it from the skipped list.
 * Returns false when the path was never blocked, so the UI can say so.
 *
 * @param {ReturnType<typeof createWorkspaceState>} state
 * @param {string} relativePath
 * @returns {boolean}
 */
export function allowPath(state, relativePath) {
  if (!state.skipped.has(relativePath)) return false;
  state.allowed.add(relativePath);
  state.skipped.delete(relativePath);
  return true;
}

/**
 * @param {ReturnType<typeof createWorkspaceState>} state
 * @param {string} relativePath
 * @returns {boolean}
 */
export function isAllowed(state, relativePath) {
  return state.allowed.has(relativePath);
}

/**
 * Record a file this session created or rewrote.
 *
 * Separate from `reads` because the panel answers a different question about
 * it: not "what did reading cost" but "what changed under my feet".
 *
 * @param {ReturnType<typeof createWorkspaceState>} state
 * @param {{ relativePath: string, bytes: number }} entry
 */
export function recordWrite(state, entry) {
  const existing = state.writes.get(entry.relativePath);
  if (existing === undefined) {
    state.writes.set(entry.relativePath, {
      path: entry.relativePath,
      bytes: entry.bytes,
      attempts: 1
    });
    return;
  }
  existing.attempts += 1;
  existing.bytes = Math.max(existing.bytes, entry.bytes);
}

/**
 * Sum the tokens the guard kept out of the context.
 *
 * @param {ReturnType<typeof createWorkspaceState>} state
 * @returns {{ min: number, max: number, bytes: number }}
 */
export function savedTokens(state) {
  let bytes = 0;
  for (const item of state.skipped.values()) {
    bytes += item.bytes;
  }
  return { ...estimateTokens(bytes), bytes };
}

/**
 * The payload the UI fetches. Deliberately flat and JSON-only: the browser
 * half must not need a schema or a build step to read it.
 *
 * @param {{ cwd: string, state: ReturnType<typeof createWorkspaceState>, policy: string }} input
 * @returns {object}
 */
export function sessionFiles(state) {
  const merged = new Map();
  for (const item of state.reads.values()) {
    merged.set(item.path, { path: item.path, bytes: item.bytes, kind: item.verdict === 'allowed' ? 'read' : item.verdict });
  }
  for (const item of state.writes.values()) {
    const existing = merged.get(item.path);
    if (existing === undefined) {
      merged.set(item.path, { path: item.path, bytes: item.bytes, kind: 'written' });
    } else {
      existing.kind = 'written';
      existing.bytes = Math.max(existing.bytes, item.bytes);
    }
  }
  return [...merged.values()]
    .map((item) => ({ ...item, tokens: estimateTokens(item.bytes) }))
    .sort((left, right) => right.bytes - left.bytes);
}

export function buildReport({ cwd, state, policy, rules = [], stats = null }) {
  const report = state.report;
  const saved = savedTokens(state);

  return {
    workspace: cwd,
    policy,
    scanned: report === undefined
      ? undefined
      : {
          files: report.scannedFiles,
          bytes: report.scannedBytes,
          healthScore: report.healthScore,
          noisePercent: report.noisePercent,
          tokenEstimate: report.tokenEstimate,
          // The panel shows two numbers: how noisy the folder is, and how much
          // of that noise still reaches the model once rules and strength are
          // applied. Dropping these here is what once made Optimize look inert.
          scoreBreakdown: report.scoreBreakdown,
          effectiveScore: report.effectiveScore,
          effectiveLost: report.effectiveLost,
          effectiveBreakdown: report.effectiveBreakdown,
          blockedBytes: report.blockedBytes,
          blockedFiles: report.blockedFiles,
          blocked: report.blocked,
          allowedBytes: report.allowedBytes,
          allowedFiles: report.allowedFiles,
          largestBytes: report.largestBytes,
          binaryBytes: report.binaryBytes,
          topNoise: report.topNoise,
          suggestedAiignore: report.suggestedAiignore,
          truncated: report.truncated === true
        },
    // The lines in .aiignore, verbatim: the panel lists them so a rule can be
    // removed one at a time instead of only "undo the whole batch".
    rules,
    // Lifetime-of-the-workspace counters. The score cannot move once the rules
    // cover everything; this can, and it is what makes the panel worth opening.
    stats: stats === null ? { blockedReads: 0, savedTokens: 0, since: null, lastAt: null } : stats,
    skipped: [...state.skipped.values()].map((item) => ({ ...item })),
    reads: [...state.reads.values()].map((item) => ({ ...item })),
    writes: [...state.writes.values()].map((item) => ({ ...item })),
    sessionFiles: sessionFiles(state),
    readTokens: estimateTokens([...state.reads.values()].reduce((sum, item) => sum + item.bytes, 0)),
    allowed: [...state.allowed],
    savedTokens: saved
  };
}
