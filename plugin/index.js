import fs from 'node:fs';
import path from 'node:path';
import { scanRepository, classifyPath, estimateTokens } from 'ai-context-doctor';
import { createWorkspaceState, recordSkip, recordRead, allowPath, isAllowed, buildReport } from './report.js';

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

/** Per-workspace record of what was skipped, so the UI can show it later. */
const workspaces = new Map();

function stateFor(cwd) {
  let state = workspaces.get(cwd);
  if (state === undefined) {
    state = createWorkspaceState();
    workspaces.set(cwd, state);
  }
  return state;
}

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

/**
 * Reads the plugin refused, grouped by workspace. Exported for tests and for
 * the UI half that lists what this session did not read.
 *
 * @param {string} [cwd]
 * @returns {Array<{ path: string, bytes: number, reason: string, attempts: number }>}
 */
export function getSkippedReads(cwd) {
  return buildReport({ cwd, state: stateFor(cwd), policy: 'deny' }).skipped;
}

/** Test seam: forget everything recorded so far. */
export function resetSkipLog() {
  workspaces.clear();
}

/**
 * Describe one read: where the file sits, how big it is, and how the classifier
 * saw it. `inside: false` means the path is not ours to judge.
 *
 * @param {{ root: string, filePath: string }} input
 * @returns {{ inside: false } | { inside: true, relativePath: string, bytes: number, classified: { noise?: object, review?: object } }}
 */
export function inspectRead({ root, filePath }) {
  if (typeof root !== 'string' || typeof filePath !== 'string') return { inside: false };

  const absolute = path.resolve(root, filePath);
  const relative = path.relative(root, absolute);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    // Outside the workspace: not ours to judge.
    return { inside: false };
  }

  let size = 0;
  try {
    const stats = fs.statSync(absolute);
    if (!stats.isFile()) return { inside: false };
    size = stats.size;
  } catch {
    // Missing file: let the read tool report that in its own words.
    return { inside: false };
  }

  const normalized = relative.split(path.sep).join('/');
  return { inside: true, relativePath: normalized, bytes: size, classified: classifyPath(normalized, size) };
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

  const inspected = inspectRead({ root, filePath });
  if (inspected.inside !== true) return { block: false };
  if (inspected.classified.noise === undefined) return { block: false };
  if (!BLOCKED_REASONS.has(inspected.classified.noise.reason)) return { block: false };

  return {
    block: true,
    relativePath: inspected.relativePath,
    bytes: inspected.bytes,
    reason: inspected.classified.noise.reason,
    tokens: estimateTokens(inspected.bytes)
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
      const state = stateFor(cwd);

      if (decision.block === true) {
        if (isAllowed(state, decision.relativePath)) {
          recordRead(state, { relativePath: decision.relativePath, bytes: decision.bytes, verdict: 'allowed' });
          return undefined;
        }
        recordSkip(state, decision);
        return formatDenial(decision);
      }

      // Not refused: still worth counting, so the panel can show what this
      // session actually spent instead of only what it saved.
      const inspected = inspectRead({ root: cwd, filePath });
      if (inspected.inside === true) {
        recordRead(state, {
          relativePath: inspected.relativePath,
          bytes: inspected.bytes,
          verdict: inspected.classified.review === undefined ? 'useful' : 'review'
        });
      }
      return undefined;
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

  // The browser half reads this workspace's state over plain HTTP: third-party
  // bundles cannot mint a remote namespace, and a route is the only channel the
  // Host exposes to them. Read-only plus one allow action, no secrets, and the
  // response is never cached.
  let latestCwd;

  const sendJson = (res, status, body) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    res.end(JSON.stringify(body));
  };

  const reportHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (latestCwd === undefined) return sendJson(res, 200, { workspace: null, skipped: [], allowed: [], savedTokens: { min: 0, max: 0, bytes: 0 } });
    return sendJson(res, 200, buildReport({ cwd: latestCwd, state: stateFor(latestCwd), policy: options.readPolicy }));
  };

  const allowHandler = (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
    // Same-origin only: the route has no authentication of its own.
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0 && origin !== `http://${req.headers.host}`) {
      return sendJson(res, 403, { error: 'cross-origin' });
    }
    if (latestCwd === undefined) return sendJson(res, 404, { error: 'nothing-scanned' });

    let body = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      let target;
      try {
        target = JSON.parse(body).path;
      } catch {
        return sendJson(res, 400, { error: 'bad-json' });
      }
      if (typeof target !== 'string' || target.length === 0) return sendJson(res, 400, { error: 'bad-path' });
      const allowed = allowPath(stateFor(latestCwd), target);
      return sendJson(res, allowed ? 200 : 404, { allowed });
    });
  };

  let routesInstalled = false;
  const installRoutes = () => {
    if (routesInstalled) return;
    try {
      const server = ctx.webServer;
      if (server === null || server === undefined || typeof server.register !== 'function') return;
      server.register({ kind: 'exact', path: '/aiignore/report', handler: reportHandler });
      server.register({ kind: 'exact', path: '/aiignore/allow', handler: allowHandler });
      routesInstalled = true;
    } catch {
      // No web server in this profile: the guard still works, the panel does not.
    }
  };

  installRoutes();

  ctx.on('agent/created', (payload) => {
    try {
      // The registry may mount after this plugin; retry here, where it exists.
      installGuard();
      installRoutes();

      const agent = payload && payload.agent ? payload.agent : payload;
      const cwd = agent && agent.session && agent.session.meta && agent.session.meta.cwd;
      if (typeof cwd !== 'string' || cwd.length === 0) return;
      if (inspected.has(cwd)) return;

      const report = scanRepository(cwd, {
        maxFiles: options.maxFiles,
        maxBytes: options.maxBytes
      });

      inspected.add(cwd);
      latestCwd = cwd;
      stateFor(cwd).report = report;

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
