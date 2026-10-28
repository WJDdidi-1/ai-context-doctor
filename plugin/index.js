import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanRepository, classifyPath, estimateTokens, matchesAiignore, parseRules, writeAiignore } from 'ai-context-doctor';
import { createWorkspaceState, recordSkip, recordRead, recordWrite, allowPath, allowAnyPath, isAllowed, buildReport } from './report.js';
import { listDirectory } from './tree.js';

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

/** Parsed `.aiignore` rules per workspace, refreshed when the file changes. */
const ruleCache = new Map();

function rulesFor(cwd) {
  try {
    const file = path.join(cwd, '.aiignore');
    const stats = fs.statSync(file);
    const cached = ruleCache.get(cwd);
    if (cached !== undefined && cached.mtimeMs === stats.mtimeMs) return cached.rules;
    const rules = [...parseRules(fs.readFileSync(file, 'utf8'))];
    ruleCache.set(cwd, { mtimeMs: stats.mtimeMs, rules });
    return rules;
  } catch {
    // No .aiignore yet, or unreadable: nothing extra to refuse.
    return [];
  }
}

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
 * @param {{ root: string, filePath: string, policy?: string, rules?: string[] }} input
 * @returns {{ block: false } | { block: true, relativePath: string, bytes: number, reason: string, rule?: string, tokens: { min: number, max: number } }}
 */
export function decideRead({ root, filePath, policy = 'deny', rules }) {
  if (policy !== 'deny') return { block: false };

  const inspected = inspectRead({ root, filePath });
  if (inspected.inside !== true) return { block: false };

  // The user's own file wins over the heuristic: a hand-written rule is a
  // decision, and it can refuse files the classifier considers clean.
  const rule = matchesAiignore(rules, inspected.relativePath);
  if (rule !== undefined) {
    return {
      block: true,
      relativePath: inspected.relativePath,
      bytes: inspected.bytes,
      reason: 'listed in .aiignore',
      rule,
      tokens: estimateTokens(inspected.bytes)
    };
  }

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
export function formatNotes(text) {
  return [
    'The user left a note for this workspace in .aiignore.notes.md:',
    '',
    text.trim(),
    '',
    'Treat it as project context from the user, not as a tool result.'
  ].join('\n');
}

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
const WRITE_TOOLS = new Set(['write', 'edit', 'multiedit', 'apply_patch', 'create']);

/** The notes file the panel edits, relative to the workspace root. */
export const NOTES_FILE = '.aiignore.notes.md';

/** A note is a paragraph for the agent, not a document. */
const NOTES_LIMIT = 4000;

/** Uploaded attachments the panel lists, newest first. */
const UPLOAD_LIMIT = 12;

function dshHome() {
  const configured = process.env.DSH_HOME;
  return typeof configured === 'string' && configured.length > 0
    ? configured
    : path.join(os.homedir(), '.dsh');
}

/**
 * Read the user's own note for this workspace.
 *
 * Deliberately a plain Markdown file in the repository: it can be reviewed,
 * committed and diffed, which is the same reason `.aiignore` is a file.
 *
 * @param {string} cwd
 * @returns {string}
 */
export function readNotes(cwd) {
  try {
    return fs.readFileSync(path.join(cwd, NOTES_FILE), 'utf8');
  } catch {
    return '';
  }
}

/**
 * Persist the note. An empty string deletes the file instead of leaving a
 * blank one behind.
 *
 * @param {string} cwd
 * @param {string} text
 * @returns {{ written: boolean, length: number }}
 */
export function writeNotes(cwd, text) {
  const target = path.join(cwd, NOTES_FILE);
  const trimmed = typeof text === 'string' ? text.slice(0, NOTES_LIMIT) : '';
  if (trimmed.trim().length === 0) {
    try {
      fs.unlinkSync(target);
    } catch {
      // Already gone.
    }
    return { written: true, length: 0 };
  }
  fs.writeFileSync(target, trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`);
  return { written: true, length: trimmed.length };
}

/**
 * Attachments the Host stored since `since` (epoch ms).
 *
 * They are content-addressed blobs with no original filename — the protocol
 * adapter drops the name before storing — so the list can only show the digest,
 * the size and a guessed type. Naming them is the Host's job, not ours.
 *
 * @param {number} since
 * @param {string} [home]
 * @returns {Array<{ name: string, bytes: number, type: string, receivedAt: number }>}
 */
export function recentUploads(since, home = dshHome()) {
  const root = path.join(home, 'attachments', 'v1', 'objects');
  const found = [];
  let buckets;
  try {
    buckets = fs.readdirSync(root);
  } catch {
    return found;
  }
  for (const bucket of buckets) {
    let names;
    try {
      names = fs.readdirSync(path.join(root, bucket));
    } catch {
      continue;
    }
    for (const name of names) {
      const absolute = path.join(root, bucket, name);
      try {
        const stats = fs.statSync(absolute);
        if (!stats.isFile() || stats.mtimeMs < since) continue;
        found.push({
          name: name.slice(0, 8),
          digest: name,
          bytes: stats.size,
          type: guessType(absolute),
          receivedAt: Math.round(stats.mtimeMs)
        });
      } catch {
        // A half-written object is not worth failing the panel over.
      }
    }
  }
  return found.sort((left, right) => right.receivedAt - left.receivedAt).slice(0, UPLOAD_LIMIT);
}

/**
 * One stored upload, addressed by content digest.
 *
 * The path is derived from a validated 64-hex digest and re-checked against the
 * objects directory, so a request cannot walk out of it.
 *
 * @param {string} digest
 * @param {string} [home]
 * @returns {{ absolute: string, type: string } | null}
 */
export function uploadFile(digest, home = dshHome()) {
  if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) return null;
  const root = path.join(home, 'attachments', 'v1', 'objects');
  const absolute = path.join(root, digest.slice(0, 2), digest);
  const within = path.relative(root, absolute);
  if (within.startsWith('..') || path.isAbsolute(within)) return null;
  try {
    const stats = fs.statSync(absolute);
    if (!stats.isFile()) return null;
    return { absolute, type: guessType(absolute) };
  } catch {
    return null;
  }
}

const IMAGE_TYPES = new Set(['png', 'jpeg', 'webp', 'gif']);
const IMAGE_LIMIT = 12 * 1024 * 1024;

/**
 * Take one rule back out of `.aiignore`.
 *
 * Deliberate limits: it only removes a line that matches the rule exactly, it
 * never removes comments or the generated header, and it refuses a symlink or a
 * non-file. The result is the file the user had before the rule was added.
 *
 * @param {string} cwd
 * @param {string} rule
 * @returns {{ removed: boolean }}
 */
export function removeAiignoreRule(cwd, rule) {
  const file = path.join(cwd, '.aiignore');
  if (typeof rule !== 'string' || rule.trim() === '') return { removed: false };
  if (!fs.existsSync(file)) return { removed: false };
  let stats;
  try {
    stats = fs.lstatSync(file);
  } catch {
    return { removed: false };
  }
  if (stats.isSymbolicLink() || !stats.isFile()) return { removed: false };

  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { removed: false };
  }

  const lines = text.split(/\r?\n/);
  const kept = lines.filter((line) => line.trim() !== rule.trim());
  if (kept.length === lines.length) return { removed: false };

  const body = kept.join('\n').replace(/\s+$/, '');
  fs.writeFileSync(file, body === '' ? '' : `${body}\n`, 'utf8');
  return { removed: true };
}

function guessType(absolute) {
  try {
    const handle = fs.openSync(absolute, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(handle, header, 0, 12, 0);
    fs.closeSync(handle);
    if (header[0] === 0x89 && header[1] === 0x50) return 'png';
    if (header[0] === 0xff && header[1] === 0xd8) return 'jpeg';
    if (header.slice(0, 4).toString('ascii') === 'RIFF') return 'webp';
    if (header.slice(0, 4).toString('ascii') === 'GIF8') return 'gif';
    if (header.slice(0, 4).toString('ascii') === '%PDF') return 'pdf';
    if (header[0] === 0x50 && header[1] === 0x4b) return 'archive';
  } catch {
    // Fall through to the generic label.
  }
  return 'file';
}

export function apply(ctx, config = {}) {
  const options = { ...DEFAULTS, ...config };
  const inspected = new Set();
  // The session started when this bundle was applied, which is the earliest
  // point an upload could have arrived for it.
  const startedAt = Date.now();
  const agents = new Map();

  const guard = (exec) => {
    try {
      if (exec === null || typeof exec !== 'object') return undefined;

      const args = exec.arguments !== null && typeof exec.arguments === 'object' ? exec.arguments : {};
      const filePath = typeof args.file_path === 'string' ? args.file_path : args.path;
      if (typeof filePath !== 'string' || filePath.length === 0) return undefined;

      const session = exec.agent !== null && exec.agent !== undefined ? exec.agent.session : undefined;
      const cwd = session !== null && session !== undefined && session.meta !== undefined ? session.meta.cwd : undefined;
      if (typeof cwd !== 'string' || cwd.length === 0) return undefined;

      // Files this session writes are listed in the panel too, so the user sees
      // what appeared under their feet even when nothing was ever refused.
      if (WRITE_TOOLS.has(exec.name)) {
        try {
          const inspected = inspectRead({ root: cwd, filePath });
          if (inspected.inside === true) {
            recordWrite(stateFor(cwd), { relativePath: inspected.relativePath, bytes: inspected.bytes });
          }
        } catch {
          // stat may fail while a tool is still writing; the path still counts.
          recordWrite(stateFor(cwd), { relativePath: filePath, bytes: 0 });
        }
        return undefined;
      }

      if (options.readPolicy !== 'deny') return undefined;
      // Only the file-read tool carries a path we can judge.
      if (exec.name !== 'read') return undefined;

      const decision = decideRead({ root: cwd, filePath, policy: options.readPolicy, rules: rulesFor(cwd) });
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
  const installGuard = (serviceCtx) => {
    if (guardInstalled) return;
    try {
      const tools = serviceCtx !== null && serviceCtx !== undefined ? serviceCtx.tools : undefined;
      if (tools !== null && tools !== undefined && typeof tools.guard === 'function') {
        tools.guard(guard);
        guardInstalled = true;
      }
    } catch {
      // Tool registry not mounted in this profile: warnings only.
    }
  };


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

  /**
   * One directory for the file manager. The query only ever names a directory
   * inside the scanned workspace; `listDirectory` refuses anything else.
   */
  const treeHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (latestCwd === undefined) return sendJson(res, 200, { workspace: null, entries: [] });
    let dir = '';
    try {
      const url = new URL(req.url, 'http://localhost');
      dir = url.searchParams.get('dir') === null ? '' : url.searchParams.get('dir');
    } catch {
      dir = '';
    }
    const listing = listDirectory({
      root: latestCwd,
      dir,
      rules: rulesFor(latestCwd),
      state: stateFor(latestCwd)
    });
    if (listing.error !== undefined) return sendJson(res, 400, { error: listing.error });
    return sendJson(res, 200, { workspace: latestCwd, ...listing });
  };

  const reportHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (latestCwd === undefined) return sendJson(res, 200, { workspace: null, skipped: [], allowed: [], savedTokens: { min: 0, max: 0, bytes: 0 } });
    return sendJson(res, 200, {
      ...buildReport({ cwd: latestCwd, state: stateFor(latestCwd), policy: options.readPolicy }),
      uploads: recentUploads(startedAt),
      notes: readNotes(latestCwd)
    });
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

      const state = stateFor(latestCwd);
      // A report row is always a previously blocked path; a file-manager row may
      // be pre-approved before the session ever tries to read it.
      if (allowPath(state, target)) return sendJson(res, 200, { allowed: true });
      const inspected = inspectRead({ root: latestCwd, filePath: target });
      if (inspected.inside !== true) return sendJson(res, 400, { error: 'outside-workspace' });
      allowAnyPath(state, inspected.relativePath);
      return sendJson(res, 200, { allowed: true });
    });
  };

  const ignoreHandler = (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
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

      const inspected = inspectRead({ root: latestCwd, filePath: target });
      if (inspected.inside !== true) return sendJson(res, 400, { error: 'outside-workspace' });

      try {
        // Recorded in the workspace, not in plugin memory: the decision survives
        // a restart, shows up in review, and the user can delete the line.
        const result = writeAiignore(path.join(latestCwd, '.aiignore'), [inspected.relativePath]);
        ruleCache.delete(latestCwd);
        return sendJson(res, 200, { ignored: true, rule: inspected.relativePath, created: result.created, added: result.added });
      } catch {
        return sendJson(res, 500, { error: 'write-failed' });
      }
    });
  };

  const unignoreHandler = (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0 && origin !== `http://${req.headers.host}`) {
      return sendJson(res, 403, { error: 'cross-origin' });
    }
    if (latestCwd === undefined) return sendJson(res, 404, { error: 'nothing-scanned' });

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      let target;
      try {
        target = JSON.parse(body).path;
      } catch {
        return sendJson(res, 400, { error: 'bad-json' });
      }
      if (typeof target !== 'string' || target.length === 0) return sendJson(res, 400, { error: 'bad-path' });

      const inspected = inspectRead({ root: latestCwd, filePath: target });
      if (inspected.inside !== true) return sendJson(res, 400, { error: 'outside-workspace' });

      try {
        const result = removeAiignoreRule(latestCwd, inspected.relativePath);
        ruleCache.delete(latestCwd);
        return sendJson(res, 200, { removed: result.removed, rule: inspected.relativePath });
      } catch {
        return sendJson(res, 500, { error: 'write-failed' });
      }
    });
  };

  const notesHandler = (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (latestCwd === undefined) return sendJson(res, 404, { error: 'nothing-scanned' });
    if (req.method === 'GET') return sendJson(res, 200, { notes: readNotes(latestCwd) });

    if (options.readPolicy === 'deny' && typeof req.headers.origin === 'string') {
      const expected = `http://${req.headers.host}`;
      if (req.headers.origin !== expected) return sendJson(res, 403, { error: 'cross-origin' });
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > NOTES_LIMIT * 2) {
        sendJson(res, 413, { error: 'too-large' });
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = body.length > 0 ? JSON.parse(body) : {};
        const text = typeof payload.text === 'string' ? payload.text : '';
        const result = writeNotes(latestCwd, text);
        // Push it now so the agent does not have to wait for the next session.
        const agent = agents.get(latestCwd);
        if (result.length > 0 && agent !== undefined && typeof agent.inject === 'function') {
          try {
            agent.inject({
              content: [{ type: 'text', text: formatNotes(text) }],
              source: { kind: 'ai-context-doctor' }
            });
          } catch {
            // Injection is best effort; the file is the durable part.
          }
        }
        return sendJson(res, 200, { ...result, injected: result.length > 0 && agent !== undefined });
      } catch {
        return sendJson(res, 400, { error: 'bad-request' });
      }
    });
  };

  const uploadHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    const url = new URL(req.url, 'http://localhost');
    const found = uploadFile(url.searchParams.get('digest') || '');
    if (found === null) return sendJson(res, 404, { error: 'no-such-upload' });
    if (!IMAGE_TYPES.has(found.type)) return sendJson(res, 415, { error: 'not-an-image' });
    let stats;
    try {
      stats = fs.statSync(found.absolute);
    } catch {
      return sendJson(res, 404, { error: 'no-such-upload' });
    }
    if (stats.size > IMAGE_LIMIT) return sendJson(res, 413, { error: 'too-large' });
    let body;
    try {
      body = fs.readFileSync(found.absolute);
    } catch {
      return sendJson(res, 404, { error: 'no-such-upload' });
    }
    res.statusCode = 200;
    // A thumbnail of a file the user just uploaded, not a public asset: keep it
    // private to this browser and make sure nothing sniffs it into HTML.
    res.setHeader('Content-Type', `image/${found.type === 'jpeg' ? 'jpeg' : found.type}`);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(body);
  };

  let routesInstalled = false;
  const installRoutes = (serviceCtx) => {
    if (routesInstalled) return;
    try {
      const server = serviceCtx !== null && serviceCtx !== undefined ? serviceCtx.webServer : undefined;
      if (server === null || server === undefined || typeof server.register !== 'function') return;
      server.register({ kind: 'exact', path: '/aiignore/report', handler: reportHandler });
      server.register({ kind: 'exact', path: '/aiignore/notes', handler: notesHandler });
      server.register({ kind: 'exact', path: '/aiignore/tree', handler: treeHandler });
      server.register({ kind: 'exact', path: '/aiignore/allow', handler: allowHandler });
      server.register({ kind: 'exact', path: '/aiignore/ignore', handler: ignoreHandler });
      server.register({ kind: 'exact', path: '/aiignore/upload', handler: uploadHandler });
      server.register({ kind: 'exact', path: '/aiignore/unignore', handler: unignoreHandler });
      routesInstalled = true;
    } catch {
      // No web server in this profile: the guard still works, the panel does not.
    }
  };

  // `tools` and `webServer` mount at their own pace, and a headless profile may
  // never have a web server at all. Deferring each installation keeps the plugin
  // useful in both shapes instead of silently doing nothing when a service is
  // absent at apply time.
  const defer = (deps, callback) => {
    try {
      if (typeof ctx.inject === 'function') ctx.inject(deps, callback);
    } catch {
      // Fall through: the service may already be mounted on this context.
    }
  };
  defer(['tools'], (serviceCtx) => installGuard(serviceCtx));
  defer(['webServer'], (serviceCtx) => installRoutes(serviceCtx));
  // Some hosts mount these before this plugin; try directly too.
  installGuard(ctx);
  installRoutes(ctx);

  ctx.on('agent/created', (payload) => {
    try {
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
      agents.set(cwd, agent);
      stateFor(cwd).report = report;

      const notes = readNotes(cwd);
      if (notes.trim().length > 0 && typeof agent.inject === 'function') {
        try {
          agent.inject({
            content: [{ type: 'text', text: formatNotes(notes) }],
            source: { kind: 'ai-context-doctor' }
          });
        } catch {
          // Never break the session over a note.
        }
      }

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
