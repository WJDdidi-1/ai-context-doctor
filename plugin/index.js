import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  scanRepository,
  classifyPath,
  estimateTokens,
  matchesAiignore,
  parseRules,
  writeAiignore,
  levelFor,
  levelBlocksCategory,
  scoreNoise,
  noiseCategory,
  LEVELS,
  DEFAULT_LEVEL
} from 'ai-context-doctor';
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
 * @param {{ root: string, filePath: string, policy?: string, rules?: string[], level?: number }} input
 * @returns {{ block: false } | { block: true, relativePath: string, bytes: number, reason: string, rule?: string, tokens: { min: number, max: number } }}
 */
export function decideRead({ root, filePath, policy = 'deny', rules, level = DEFAULT_LEVEL }) {
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

  // Then the strength the user set. One slider, one meaning: each level names
  // what it stops and what that costs, and the same numbers drive the guard.
  const entry = levelFor(level);
  const noise = inspected.classified.noise;
  if (noise !== undefined && levelBlocksCategory(entry, noiseCategory(noise.reason))) {
    return {
      block: true,
      relativePath: inspected.relativePath,
      bytes: inspected.bytes,
      reason: noise.reason,
      tokens: estimateTokens(inspected.bytes)
    };
  }

  if (Number.isFinite(entry.maxBytes) && inspected.bytes > entry.maxBytes) {
    return {
      block: true,
      relativePath: inspected.relativePath,
      bytes: inspected.bytes,
      reason: `larger than the ${entry.label.toLowerCase()} limit (${formatBytes(entry.maxBytes)})`,
      tokens: estimateTokens(inspected.bytes)
    };
  }

  return { block: false };
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
/**
 * Every workspace the app already knows about, read from the same store the
 * workspace switcher uses. The panel uses this when it cannot work out which
 * directory the conversation belongs to: rather than showing an empty screen, it
 * offers the folders the user has actually been working in.
 */
const headerCache = new Map();

/** The user's filtering strength, stored next to the rules it complements. */
export const POLICY_FILE = '.aiignore.policy.json';

/**
 * Which strength this workspace uses. An unreadable or unknown value falls back
 * to the recommended level instead of turning the guard off.
 *
 * @param {string} cwd
 * @returns {number}
 */
export function readPolicy(cwd) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(cwd, POLICY_FILE), 'utf8'));
    const level = Number(parsed.level);
    if (LEVELS.some((entry) => entry.level === level)) return level;
  } catch {
    // No policy file yet, or it is not ours to read.
  }
  return DEFAULT_LEVEL;
}

/**
 * Persist a strength. Returns the resolved level so the caller echoes what was
 * stored rather than what was asked for.
 *
 * @param {string} cwd
 * @param {number} level
 * @returns {object}
 */
export function writePolicy(cwd, level) {
  const entry = levelFor(level);
  fs.writeFileSync(
    path.join(cwd, POLICY_FILE),
    `${JSON.stringify({ level: entry.level, key: entry.key }, null, 2)}\n`
  );
  return entry;
}

/**
 * A session log opens with one zstd frame holding
 * `{"type":"session","id":...,"cwd":...}`. Reading that header is how the Host
 * half learns which directory a conversation belongs to — the workspace store
 * only lists sessions that existed when it was last written, which is exactly
 * why a conversation started afterwards fell back to the first workspace.
 *
 * Only the first frame is decoded: `zstdDecompressSync` stops at the frame
 * boundary, so an 8 MB append-only log costs the same as its header.
 */
export function sessionHeader(dir) {
  const log = path.join(dir, 'session.v4.jsonl.zstd');
  let stats;
  try {
    stats = fs.statSync(log);
  } catch {
    return null;
  }

  const key = `${log}\u0000${stats.mtimeMs}\u0000${stats.size}`;
  const cached = headerCache.get(key);
  if (cached !== undefined) return cached;

  let header;
  try {
    const text = zlib.zstdDecompressSync(fs.readFileSync(log)).toString('utf8');
    const parsed = JSON.parse(text.split('\n')[0]);
    header = {
      id: typeof parsed.id === 'string' ? parsed.id : null,
      cwd: typeof parsed.cwd === 'string' ? parsed.cwd : null
    };
  } catch {
    return null;
  }

  if (headerCache.size > 200) headerCache.clear();
  headerCache.set(key, header);
  return header;
}

/**
 * The app keeps one projection file per conversation, and it is where the
 * conversation's own facts live: its title, its directory, what it spent, and
 * every file operation it performed. Reading it is how "this conversation"
 * becomes a thing this plugin can answer about, instead of "this folder".
 */
export function projectionPath(sessionId, home = dshHome()) {
  if (typeof sessionId !== 'string' || !/^session-[0-9a-f][0-9a-f-]{6,}$/.test(sessionId)) return null;
  return path.join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`);
}

/**
 * The parts of a conversation projection that mean something here.
 *
 * @param {string} sessionId
 * @param {string} [home]
 * @returns {object|null}
 */
export function readProjection(sessionId, home = dshHome()) {
  const file = projectionPath(sessionId, home);
  if (file === null) return null;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }

  const record = parsed !== null && typeof parsed === 'object' ? parsed.record : undefined;
  if (record === undefined || typeof record !== 'object') return null;
  const rows = typeof record.rows === 'object' && record.rows !== null ? record.rows : {};
  const value = (row) => (rows[row] !== undefined && rows[row] !== null ? rows[row].val : undefined);

  const timeline = value('contextTimeline') || {};
  const stats = value('sessionStats') || {};
  const breakdown = value('contextBreakdown') || {};

  return {
    id: sessionId,
    title: typeof value('title') === 'string' ? value('title') : '',
    cwd: record.identity !== undefined && typeof record.identity.cwd === 'string' ? record.identity.cwd : undefined,
    turns: typeof stats.turns === 'number' ? stats.turns : 0,
    steps: typeof stats.steps === 'number' ? stats.steps : 0,
    sums: typeof timeline.sums === 'object' && timeline.sums !== null ? timeline.sums : {},
    systemTokens: typeof timeline.systemTokens === 'number' ? timeline.systemTokens : 0,
    toolsTokens: typeof timeline.toolsTokens === 'number' ? timeline.toolsTokens : 0,
    contextWindow: typeof timeline.contextWindow === 'number' ? timeline.contextWindow : 0,
    surfaceTokens: typeof breakdown.surfaceTokens === 'number' ? breakdown.surfaceTokens : 0,
    fileOps: Array.isArray(timeline.fileOps) ? timeline.fileOps : []
  };
}

/** Aggregate the raw operations into one row per path. */
function filesFromOps(ops, cwd) {
  const byPath = new Map();

  for (const op of ops) {
    if (op === null || typeof op !== 'object' || typeof op.path !== 'string') continue;
    const entry = byPath.get(op.path) || {
      path: op.path,
      reads: 0,
      writes: 0,
      added: 0,
      removed: 0,
      lastAt: 0,
      failed: false
    };
    if (op.kind === 'write') entry.writes += 1;
    else entry.reads += 1;
    entry.added += typeof op.added === 'number' ? op.added : 0;
    entry.removed += typeof op.removed === 'number' ? op.removed : 0;
    entry.lastAt = Math.max(entry.lastAt, typeof op.time === 'number' ? op.time : 0);
    entry.failed = entry.failed || op.err === true;
    byPath.set(op.path, entry);
  }

  const rows = [];
  for (const entry of byPath.values()) {
    let relative = null;
    if (typeof cwd === 'string' && cwd.length > 0) {
      const rel = path.relative(cwd, entry.path);
      if (rel.length > 0 && rel.startsWith('..') === false && path.isAbsolute(rel) === false) relative = rel;
    }
    let bytes = 0;
    try {
      const stats = fs.statSync(entry.path);
      if (stats.isFile()) bytes = stats.size;
    } catch {
      // Deleted, or outside anything we can read: size stays 0.
    }
    const classified = relative === null ? undefined : classifyPath(relative, bytes);
    const noise = classified !== undefined && classified.noise !== undefined ? classified.noise : undefined;
    rows.push({
      path: entry.path,
      relativePath: relative,
      reads: entry.reads,
      writes: entry.writes,
      added: entry.added,
      removed: entry.removed,
      lastAt: entry.lastAt,
      failed: entry.failed,
      bytes,
      reason: noise !== undefined ? noise.reason : undefined,
      category: noise !== undefined ? noiseCategory(noise.reason) : undefined
    });
  }

  return rows.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path));
}

/** Rules that would have kept these files out, one per directory that earns it. */
function rulesForFiles(files) {
  const rules = [];
  const seenDirs = new Set();

  for (const file of files) {
    if (file.relativePath === null || file.reason === undefined) continue;
    const parts = file.relativePath.split('/');
    if (parts.length > 1) {
      const dir = `${parts[0]}/`;
      if (seenDirs.has(dir) === false) {
        seenDirs.add(dir);
        rules.push(dir);
      }
      continue;
    }
    if (rules.includes(file.relativePath) === false) rules.push(file.relativePath);
  }

  return rules.slice(0, 20);
}

/**
 * What this conversation cost, and how much of it was noise.
 *
 * The score is the same arithmetic the workspace uses — four weighted losses —
 * but the denominator is what this conversation actually pulled in, so it
 * answers a different question: "was *this* conversation noisy?", not "is this
 * repository tidy?".
 *
 * @param {string} sessionId
 * @param {{ home?: string }} [options]
 * @returns {object|null}
 */
export function conversationReport(sessionId, options = {}) {
  const home = typeof options.home === 'string' ? options.home : dshHome();
  const projection = readProjection(sessionId, home);
  if (projection === null) return null;

  const files = filesFromOps(projection.fileOps, projection.cwd);
  const read = files.filter((file) => file.reads > 0);
  const readBytes = read.reduce((sum, file) => sum + file.bytes, 0);
  const noiseFiles = read.filter((file) => file.reason !== undefined && file.category !== undefined);
  const scored = scoreNoise(noiseFiles.map((file) => ({ bytes: file.bytes, reason: file.reason })), readBytes);

  return {
    id: projection.id,
    title: projection.title,
    cwd: projection.cwd,
    turns: projection.turns,
    steps: projection.steps,
    contextWindow: projection.contextWindow,
    surfaceTokens: projection.surfaceTokens,
    systemTokens: projection.systemTokens,
    toolsTokens: projection.toolsTokens,
    tokens: projection.sums,
    readFiles: read.length,
    writtenFiles: files.filter((file) => file.writes > 0).length,
    readBytes,
    noiseBytes: noiseFiles.reduce((sum, file) => sum + file.bytes, 0),
    score: scored.score,
    scoreLost: scored.lost,
    scoreBreakdown: scored.breakdown,
    noise: noiseFiles.slice(0, 8).map((file) => ({
      path: file.relativePath === null ? file.path : file.relativePath,
      relativePath: file.relativePath,
      bytes: file.bytes,
      reason: file.reason
    })),
    suggestedAiignore: rulesForFiles(noiseFiles)
  };
}

/** The session store: one directory per cwd, one directory per session inside. */
export function sessionsRoot(home = dshHome()) {
  return path.join(home, 'sessions');
}

/**
 * The session that wrote last. The Harness appends to a session's log as the
 * conversation moves, so the freshest log is the conversation in front of the
 * user — the one fact the Host half can learn about "this conversation" without
 * being told, and the reason the panel no longer has to ask.
 */
export function activeSession(home = dshHome()) {
  const root = sessionsRoot(home);
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  let best = null;
  for (const bucket of entries) {
    if (bucket.isDirectory() !== true) continue;
    const bucketPath = path.join(root, bucket.name);
    let sessions;
    try {
      sessions = fs.readdirSync(bucketPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      if (session.isDirectory() !== true || session.name.startsWith('session-') !== true) continue;
      const dir = path.join(bucketPath, session.name);
      const log = path.join(dir, 'session.v4.jsonl.zstd');
      let at = 0;
      try {
        at = fs.statSync(log).mtimeMs;
      } catch {
        try {
          at = fs.statSync(dir).mtimeMs;
        } catch {
          continue;
        }
      }
      // Opening a conversation rewrites its projection file, so that time is the
      // second freshness signal: a conversation the user just switched to beats
      // one that merely had a turn earlier.
      const projection = projectionPath(session.name, home);
      if (projection !== null) {
        try {
          at = Math.max(at, fs.statSync(projection).mtimeMs);
        } catch {
          // No projection yet: the log time stands alone.
        }
      }
      if (best === null || at > best.at) {
        const header = sessionHeader(dir);
        best = {
          id: session.name,
          at,
          cwd: header !== null && typeof header.cwd === 'string' ? header.cwd : undefined
        };
      }
    }
  }
  return best;
}

/** Which workspace a session belongs to, according to the app's own store. */
export function workspaceForSession(sessionId, home = dshHome()) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined;
  let store;
  try {
    store = JSON.parse(fs.readFileSync(path.join(home, 'storages', 'workspace.json'), 'utf8'));
  } catch {
    return undefined;
  }
  const table = store !== null && typeof store === 'object' && store.tables !== undefined ? store.tables.workspaces : undefined;
  if (table === null || typeof table !== 'object') return undefined;
  for (const workspace of Object.values(table)) {
    if (workspace === null || typeof workspace !== 'object') continue;
    if (Array.isArray(workspace.sessionIds) !== true || workspace.sessionIds.includes(sessionId) !== true) continue;
    if (typeof workspace.path !== 'string') continue;
    try {
      if (fs.statSync(workspace.path).isDirectory() === true) return workspace.path;
    } catch {
      // A workspace whose folder is gone is not a workspace.
    }
  }
  return undefined;
}

/** The folder the conversation in front of the user is working in. */
export function activeWorkspace(home = dshHome()) {
  const session = activeSession(home);
  if (session === null) return undefined;
  // The log's own header first: it is exact, while the workspace store has to be
  // told about a session before it can answer for it.
  if (typeof session.cwd === 'string' && session.cwd.length > 0) {
    try {
      if (fs.statSync(session.cwd).isDirectory() === true) return session.cwd;
    } catch {
      // Folder gone; fall through to the store.
    }
  }
  return workspaceForSession(session.id, home);
}

/**
 * The conversations still on disk, newest first. The panel needs more than one:
 * a workspace usually holds several conversations, and "analyse this chat"
 * means the chat, not the folder.
 */
export function recentSessions(home = dshHome(), limit = 12) {
  const root = sessionsRoot(home);
  let buckets;
  try {
    buckets = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const found = [];
  for (const bucket of buckets) {
    if (bucket.isDirectory() !== true) continue;
    const bucketPath = path.join(root, bucket.name);
    let sessions;
    try {
      sessions = fs.readdirSync(bucketPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      if (session.isDirectory() !== true || session.name.startsWith('session-') !== true) continue;
      const dir = path.join(bucketPath, session.name);
      let at = 0;
      try {
        at = fs.statSync(path.join(dir, 'session.v4.jsonl.zstd')).mtimeMs;
      } catch {
        continue;
      }
      // Opening a conversation rewrites its projection, which is a better
      // "this is the one in front of you" signal than the log alone.
      const projection = projectionPath(session.name, home);
      if (projection !== null) {
        try {
          at = Math.max(at, fs.statSync(projection).mtimeMs);
        } catch {
          // no projection yet: the log timestamp stands.
        }
      }
      const header = sessionHeader(dir);
      found.push({
        id: session.name,
        at,
        cwd: header !== null && typeof header.cwd === 'string' ? header.cwd : undefined
      });
    }
  }

  return found
    .sort((left, right) => right.at - left.at)
    .slice(0, limit)
    .map((entry) => ({ ...entry, at: Math.round(entry.at) }));
}

export function knownWorkspaces(home = dshHome()) {
  const file = path.join(home, 'storages', 'workspace.json');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  const table = parsed !== null && typeof parsed === 'object' && parsed.tables !== undefined && parsed.tables !== null
    ? parsed.tables.workspaces
    : undefined;
  if (table === null || typeof table !== 'object') return [];
  const seen = new Set();
  const found = [];
  for (const entry of Object.values(table)) {
    if (entry === null || typeof entry !== 'object') continue;
    const dir = typeof entry.path === 'string' ? entry.path : undefined;
    if (dir === undefined || seen.has(dir)) continue;
    let isDirectory = false;
    try {
      isDirectory = fs.statSync(dir).isDirectory();
    } catch {
      isDirectory = false;
    }
    if (!isDirectory) continue;
    seen.add(dir);
    found.push({
      path: dir,
      title: typeof entry.title === 'string' && entry.title.length > 0 ? entry.title : path.basename(dir),
      sessions: Array.isArray(entry.sessionIds) ? entry.sessionIds.length : 0
    });
  }
  // Most-used first: that is the one the user is most likely looking for.
  return found.sort((left, right) => right.sessions - left.sessions || left.title.localeCompare(right.title));
}

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

/** What the last Optimize wrote, so one click can put it back. */
const optimizeBackup = new Map();

/**
 * One click: turn the report's suggestions into `.aiignore` and remember what was
 * there before. The effect is real — the guard reads this file on every read, so
 * the noise stops reaching the model immediately, not at the next restart.
 *
 * @param {string} cwd
 * @param {ReturnType<typeof scanRepository>} report
 * @param {string[]} [rules] Rules to write instead of the workspace's own suggestions.
 * @returns {{ added: string[], written: boolean, saved: { min: number, max: number } }}
 */
export function optimizeWorkspace(cwd, report, rules) {
  const target = path.join(cwd, '.aiignore');
  let previous = null;
  try {
    previous = fs.readFileSync(target, 'utf8');
  } catch {
    previous = null;
  }

  const wanted = Array.isArray(rules) && rules.length > 0 ? rules : report.suggestedAiignore;
  const result = writeAiignore(target, wanted);
  optimizeBackup.set(cwd, { previous, at: Date.now() });
  ruleCache.delete(cwd);

  const noise = report.tokenEstimate !== undefined && report.tokenEstimate.noise !== undefined
    ? report.tokenEstimate.noise
    : { min: 0, max: 0 };
  return { added: result.added, written: result.written, saved: noise };
}

/**
 * Put the file back exactly as it was before the last Optimize.
 *
 * @param {string} cwd
 * @returns {{ undone: boolean, restored: 'previous' | 'removed' | 'none' }}
 */
export function undoOptimize(cwd) {
  const backup = optimizeBackup.get(cwd);
  if (backup === undefined) return { undone: false, restored: 'none' };

  const target = path.join(cwd, '.aiignore');
  try {
    if (backup.previous === null) fs.unlinkSync(target);
    else fs.writeFileSync(target, backup.previous);
  } catch {
    return { undone: false, restored: 'none' };
  }

  optimizeBackup.delete(cwd);
  ruleCache.delete(cwd);
  return { undone: true, restored: backup.previous === null ? 'removed' : 'previous' };
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

      const decision = decideRead({ root: cwd, filePath, policy: options.readPolicy, rules: rulesFor(cwd), level: readPolicy(cwd) });
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

  // `agent/created` is emitted on the agent's own carrier, which a bundle in a
  // different branch of the tree never hears. Asking the registries is the
  // channel that always exists, so the workspace is resolved on demand instead
  // of only from an event.
  let agentRegistry;
  let sessionRegistry;

  const cwdOf = (holder) => {
    const meta = holder !== null && holder !== undefined && holder.session !== undefined ? holder.session.meta : undefined;
    return typeof meta === 'object' && meta !== null && typeof meta.cwd === 'string' && meta.cwd.length > 0 ? meta.cwd : undefined;
  };

  // How the workspace was chosen, so the panel can say "following this
  // conversation" instead of pretending the user picked it.
  let resolvedSource = 'none';

  /** The session the panel is following, when the store told us. */
  let latestSession = null;

  const resolveWorkspace = () => {
    // The session store is consulted first: it is the only source that follows
    // the conversation the user is actually looking at. Registries and the last
    // scan are fallbacks for the case where the store is unavailable.
    try {
      const automatic = activeWorkspace();
      if (automatic !== undefined) {
        resolvedSource = 'session';
        latestSession = activeSession();
        return automatic;
      }
    } catch {
      // No session store: fall through to what we already knew.
    }
    if (typeof latestCwd === 'string' && latestCwd.length > 0) {
      resolvedSource = 'last';
      return latestCwd;
    }
    const pools = [];
    try {
      if (agentRegistry !== undefined && typeof agentRegistry.list === 'function') pools.push(agentRegistry.list());
      if (sessionRegistry !== undefined && typeof sessionRegistry.list === 'function') pools.push(sessionRegistry.list());
    } catch {
      // A registry that refuses to list leaves us where we were.
    }
    for (const pool of pools) {
      if (!Array.isArray(pool)) continue;
      // Newest first: the session the user is looking at is the last one made.
      for (let index = pool.length - 1; index >= 0; index -= 1) {
        const cwd = cwdOf(pool[index]);
        if (cwd !== undefined) {
          resolvedSource = 'registry';
          return cwd;
        }
      }
    }
    return undefined;
  };

  /**
   * Scan `cwd` and make it the workspace the panel talks about. Exported logic
   * lives here so both the event and the explicit Scan button use one path.
   */
  /**
   * One scan, with everything the user has decided applied: their own rules and
   * the strength on the slider. `healthScore` says how noisy the folder is;
   * `effectiveScore` says how much of that noise still reaches the model — which
   * is the number the Optimize button has to move.
   */
  const scanWithPolicy = (cwd, extra = {}) => {
    let rules = [];
    try {
      rules = parseRules(fs.readFileSync(path.join(cwd, '.aiignore'), 'utf8'));
    } catch {
      rules = [];
    }
    return scanRepository(cwd, {
      maxFiles: options.maxFiles,
      maxBytes: options.maxBytes,
      rules,
      level: readPolicy(cwd),
      ...extra
    });
  };

  const scanWorkspace = (cwd) => {
    const report = scanWithPolicy(cwd);
    latestCwd = cwd;
    inspected.add(cwd);
    stateFor(cwd).report = report;
    return report;
  };

  /**
   * The panel knows which conversation it belongs to, and therefore which
   * directory: the slot it renders in is given the session id and the sessions
   * store. The Host half cannot always learn that on its own — a bundle can be
   * applied on a branch that never sees `agent/created`, and the registries may
   * hand back sessions whose `meta.cwd` is empty — so the browser is allowed to
   * name its own workspace.
   */
  const askedCwd = (req) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const value = url.searchParams.get('cwd');
      if (typeof value !== 'string' || value.length === 0) return undefined;
      if (!path.isAbsolute(value)) return undefined;
      const stats = fs.statSync(value);
      if (stats.isDirectory() !== true) return undefined;
      return path.resolve(value);
    } catch {
      return undefined;
    }
  };

  /** Same-origin only: these routes have no authentication of their own. */
  const crossOrigin = (req) => {
    const origin = req.headers.origin;
    return typeof origin === 'string' && origin.length > 0 && origin !== `http://${req.headers.host}`;
  };

  /** Bind the panel to the workspace it names, scanning it when it is new. */
  const bindWorkspace = (req) => {
    const asked = askedCwd(req);
    if (asked !== undefined) {
      if (asked !== latestCwd) scanWorkspace(asked);
      resolvedSource = 'request';
      return asked;
    }
    return ensureWorkspace();
  };

  /** Resolve and scan when needed; returns the workspace the panel should use. */
  const ensureWorkspace = () => {
    const cwd = resolveWorkspace();
    if (cwd === undefined) return undefined;
    if (cwd !== latestCwd || stateFor(cwd).report === undefined) scanWorkspace(cwd);
    return cwd;
  };

  // The overview scans other folders too, so it gets its own budget: small
  // enough to answer in a second, and cached, because a summary page is opened
  // far more often than a folder changes.
  const overviewCache = new Map();
  const OVERVIEW_TTL = 5 * 60 * 1000;
  const OVERVIEW_LIMITS = { maxFiles: 4000, maxBytes: 48 * 1024 * 1024 };

  const overviewOf = (entry) => {
    const cached = overviewCache.get(entry.path);
    if (cached !== undefined && Date.now() - cached.at < OVERVIEW_TTL) return cached.value;
    let report;
    try {
      report = scanWithPolicy(entry.path, OVERVIEW_LIMITS);
    } catch {
      return { path: entry.path, title: entry.title, sessions: entry.sessions, error: 'unreadable' };
    }
    const value = {
      path: entry.path,
      title: entry.title,
      sessions: entry.sessions,
      healthScore: report.healthScore,
      effectiveScore: typeof report.effectiveScore === 'number' ? report.effectiveScore : report.healthScore,
      suggested: Array.isArray(report.suggestedAiignore) ? report.suggestedAiignore.length : 0,
      level: readPolicy(entry.path),
      files: report.scannedFiles,
      bytes: report.scannedBytes,
      noisePercent: report.noisePercent,
      noise: report.topNoise.slice(0, 2).map((item) => item.path),
      truncated: report.truncated === true
    };
    overviewCache.set(entry.path, { at: Date.now(), value });
    return value;
  };

  // The strength slider has to show what each notch would cost, so the same
  // folder is scored five times (once per level) and cached briefly. Five scans
  // of one folder is cheap; five per keystroke would not be.
  const levelsCache = new Map();
  const LEVELS_TTL = 60 * 1000;

  const levelsFor = (cwd) => {
    const cached = levelsCache.get(cwd);
    if (cached !== undefined && Date.now() - cached.at < LEVELS_TTL && cached.level === readPolicy(cwd)) {
      return cached.value;
    }
    const value = LEVELS.map((entry) => {
      let report;
      try {
        report = scanWithPolicy(cwd, { level: entry.level, maxFiles: 4000, maxBytes: 48 * 1024 * 1024 });
      } catch {
        return { level: entry.level, label: entry.label, note: entry.note, maxBytes: entry.maxBytes, effectiveScore: null, blockedBytes: null };
      }
      return {
        level: entry.level,
        label: entry.label,
        note: entry.note,
        maxBytes: entry.maxBytes,
        effectiveScore: report.effectiveScore,
        blockedBytes: report.blockedBytes,
        rules: Array.isArray(report.suggestedAiignore) ? report.suggestedAiignore.length : 0
      };
    });
    levelsCache.set(cwd, { at: Date.now(), value, level: readPolicy(cwd) });
    return value;
  };

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
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    if (bindWorkspace(req) === undefined) return sendJson(res, 200, { workspace: null, entries: [] });
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
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    if (bindWorkspace(req) === undefined) return sendJson(res, 200, { workspace: null, source: 'none', skipped: [], allowed: [], savedTokens: { min: 0, max: 0, bytes: 0 } });
    return sendJson(res, 200, {
      ...buildReport({ cwd: latestCwd, state: stateFor(latestCwd), policy: options.readPolicy }),
      source: resolvedSource,
      session: resolvedSource === 'session' && latestSession !== null
        ? { id: latestSession.id, at: latestSession.at }
        : null,
      level: readPolicy(latestCwd),
      levels: LEVELS,
      uploads: recentUploads(startedAt),
      notes: readNotes(latestCwd),
      notesInjected: formatNotes(readNotes(latestCwd))
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
    // The note belongs to the conversation's own directory, not to whichever
    // one was scanned last.
    bindWorkspace(req);
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

  /**
   * The folders this app has been used in. The panel shows them when it has no
   * workspace of its own, so "no workspace selected" is a choice instead of a
   * dead end.
   */
  const overviewHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    let list = [];
    try {
      list = knownWorkspaces();
    } catch {
      list = [];
    }
    // `?fresh=1` is the "Scan again" button on the summary page: the cached
    // numbers are five minutes old, and someone just changed something.
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.searchParams.get('fresh') === '1') overviewCache.clear();
    } catch {
      /* no query, nothing to refresh */
    }
    const current = bindWorkspace(req);
    return sendJson(res, 200, {
      current: typeof current === 'string' ? current : null,
      source: resolvedSource,
      workspaces: list.map(overviewOf)
    });
  };

  /**
   * What each notch of the strength slider would score. The number that matters
   * is `effectiveScore`, and it only becomes a decision once the five options
   * sit next to each other with their own numbers.
   */
  const levelsHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    const cwd = askedCwd(req) !== undefined ? askedCwd(req) : resolveWorkspace();
    if (cwd === undefined || cwd === null) return sendJson(res, 200, { workspace: null, level: null, levels: [] });
    return sendJson(res, 200, {
      workspace: cwd,
      level: readPolicy(cwd),
      levels: levelsFor(cwd)
    });
  };

  const workspacesHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    let list = [];
    try {
      list = knownWorkspaces();
    } catch {
      list = [];
    }
    return sendJson(res, 200, {
      current: typeof latestCwd === 'string' ? latestCwd : null,
      workspaces: list
    });
  };

  /** What the browser half could see, so a mismatch is diagnosable. */
  let clientReport = null;

  const clientReportHandler = (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    let raw = '';
    req.on('data', (chunk) => {
      if (raw.length > 4000) return;
      raw += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(raw);
        clientReport = {
          at: new Date().toISOString(),
          keys: Array.isArray(payload.keys) ? payload.keys.slice(0, 40).map(String) : [],
          sessionId: typeof payload.sessionId === 'string' ? payload.sessionId.slice(0, 120) : null,
          hasUseSessions: payload.hasUseSessions === true,
          cwd: typeof payload.cwd === 'string' ? payload.cwd.slice(0, 400) : null
        };
      } catch {
        clientReport = { at: new Date().toISOString(), error: 'bad-payload' };
      }
      return sendJson(res, 200, { received: true });
    });
  };

  const debugHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    return sendJson(res, 200, {
      workspace: typeof latestCwd === 'string' ? latestCwd : null,
      resolved: (() => {
        try {
          return resolveWorkspace() || null;
        } catch {
          return null;
        }
      })(),
      hasAgents: agentRegistry !== undefined,
      hasSessions: sessionRegistry !== undefined,
      client: clientReport,
      workspaces: (() => {
        try {
          return knownWorkspaces().length;
        } catch {
          return 0;
        }
      })()
    });
  };

  /**
   * Scan the workspace of the conversation the user is looking at. The panel
   * offers this as a button so a session that predates the bundle — or a host
   * that never announced it — still gets a report.
   */
  const scanHandler = (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    const cwd = askedCwd(req) !== undefined ? askedCwd(req) : resolveWorkspace();
    if (cwd === undefined) return sendJson(res, 404, { error: 'no-workspace' });
    try {
      // An explicit scan re-reads the tree even when this workspace was already
      // scanned: the user pressed the button because they expect fresh numbers.
      latestCwd = undefined;
      const report = scanWorkspace(cwd);
      return sendJson(res, 200, { workspace: cwd, ...report });
    } catch {
      return sendJson(res, 400, { error: 'scan-failed' });
    }
  };

  /** The conversations on disk, newest first, each with the directory it runs in. */
  const sessionsHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    const active = activeSession();
    return sendJson(res, 200, {
      current: active === null ? null : active.id,
      sessions: recentSessions()
    });
  };

  /**
   * One conversation, by id. Without an id it answers about the conversation
   * the panel is following, which is what the "This conversation" tab wants.
   */
  const conversationHandler = (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });

    const asked = new URL(req.url, 'http://localhost').searchParams.get('session');
    let id = asked;
    if (id === null || id.length === 0) {
      const active = activeSession();
      id = active === null ? null : active.id;
    }
    if (id === null) return sendJson(res, 404, { error: 'no-conversation' });

    const report = conversationReport(id);
    if (report === null) return sendJson(res, 404, { error: 'no-projection', session: id });
    return sendJson(res, 200, { ...report, available: recentSessions().map((entry) => ({ id: entry.id, at: entry.at, cwd: entry.cwd })) });
  };

  /** The strength the user picked, and the numbers behind every level. */
  const policyHandler = (req, res) => {
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    const cwd = askedCwd(req) !== undefined ? askedCwd(req) : resolveWorkspace();
    if (cwd === undefined) return sendJson(res, 404, { error: 'no-workspace' });

    if (req.method === 'GET') {
      const level = readPolicy(cwd);
      return sendJson(res, 200, { level, levels: LEVELS, policy: options.readPolicy });
    }

    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2000) req.destroy();
    });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: 'invalid-json' });
      }
      try {
        const entry = writePolicy(cwd, parsed !== null && typeof parsed === 'object' ? parsed.level : undefined);
        return sendJson(res, 200, { level: entry.level, key: entry.key, levels: LEVELS });
      } catch {
        return sendJson(res, 400, { error: 'write-failed' });
      }
    });
  };

  /**
   * One click: write the suggested rules, so the guard stops serving noise.
   *
   * With `{ "session": "session-..." }` the rules come from that conversation's
   * own reads instead of the whole workspace, and the answer reports which of
   * those reads would now be blocked — an optimisation the user can check.
   */
  const optimizeHandler = (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20000) req.destroy();
    });
    req.on('end', () => {
      let parsed = {};
      if (body.trim().length > 0) {
        try {
          parsed = JSON.parse(body);
        } catch {
          return sendJson(res, 400, { error: 'invalid-json' });
        }
      }

      const asked = parsed !== null && typeof parsed === 'object' && typeof parsed.session === 'string' ? parsed.session : null;
      let conversation = null;
      if (asked !== null) {
        conversation = conversationReport(asked);
        if (conversation === null) return sendJson(res, 404, { error: 'no-projection', session: asked });
      }

      // The summary page acts on a row the panel is not showing, so it names the
      // folder itself; the panel just omits it and gets its own workspace.
      const named = parsed !== null && typeof parsed === 'object' && typeof parsed.cwd === 'string' && path.isAbsolute(parsed.cwd)
        ? path.resolve(parsed.cwd)
        : undefined;
      const cwd = named !== undefined
        ? named
        : (askedCwd(req) !== undefined
          ? askedCwd(req)
          : (conversation !== null && conversation.cwd !== null ? conversation.cwd : resolveWorkspace()));
      if (cwd === undefined || cwd === null) return sendJson(res, 404, { error: 'no-workspace' });

      try {
        const before = scanWithPolicy(cwd);
        const rules = conversation !== null ? conversation.suggestedAiignore : undefined;
        const result = optimizeWorkspace(cwd, before, rules);
        const after = scanWithPolicy(cwd);
        stateFor(cwd).report = after;
        overviewCache.delete(cwd);
        levelsCache.delete(cwd);
        if (latestCwd === cwd) latestCwd = cwd;

        // Proof the click did something: every noise read of this conversation,
        // tested against the rules that now exist on disk.
        const blockedNow = [];
        if (conversation !== null) {
          let written = [];
          try {
            written = parseRules(fs.readFileSync(path.join(cwd, '.aiignore'), 'utf8'));
          } catch {
            written = [];
          }
          for (const item of conversation.noise) {
            const relative = item.relativePath;
            blockedNow.push({ path: relative, blocked: relative !== undefined && matchesAiignore(written, relative) !== null });
          }
        }

        return sendJson(res, 200, {
          workspace: cwd,
          ...result,
          session: conversation === null ? null : conversation.id,
          before: before.effectiveScore,
          after: after.effectiveScore,
          rawBefore: before.healthScore,
          rawAfter: after.healthScore,
          blockedNow
        });
      } catch {
        return sendJson(res, 400, { error: 'optimize-failed' });
      }
    });
  };

  const undoOptimizeHandler = (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (crossOrigin(req) === true) return sendJson(res, 403, { error: 'cross-origin' });
    const cwd = askedCwd(req) !== undefined ? askedCwd(req) : resolveWorkspace();
    if (cwd === undefined) return sendJson(res, 404, { error: 'no-workspace' });
    return sendJson(res, 200, { workspace: cwd, ...undoOptimize(cwd) });
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
      server.register({ kind: 'exact', path: '/aiignore/scan', handler: scanHandler });
      server.register({ kind: 'exact', path: '/aiignore/workspaces', handler: workspacesHandler });
      server.register({ kind: 'exact', path: '/aiignore/overview', handler: overviewHandler });
      server.register({ kind: 'exact', path: '/aiignore/client-report', handler: clientReportHandler });
      server.register({ kind: 'exact', path: '/aiignore/debug', handler: debugHandler });
      server.register({ kind: 'exact', path: '/aiignore/sessions', handler: sessionsHandler });
      server.register({ kind: 'exact', path: '/aiignore/conversation', handler: conversationHandler });
      server.register({ kind: 'exact', path: '/aiignore/policy', handler: policyHandler });
      server.register({ kind: 'exact', path: '/aiignore/levels', handler: levelsHandler });
      server.register({ kind: 'exact', path: '/aiignore/optimize', handler: optimizeHandler });
      server.register({ kind: 'exact', path: '/aiignore/optimize/undo', handler: undoOptimizeHandler });
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
  // The panel needs to know which directory the conversation runs in; the
  // registries are the only channel that does not depend on event routing.
  defer(['agents'], (serviceCtx) => { agentRegistry = serviceCtx.agents; });
  defer(['sessions'], (serviceCtx) => { sessionRegistry = serviceCtx.sessions; });
  // Some hosts mount these before this plugin; try directly too.
  installGuard(ctx);
  installRoutes(ctx);

  ctx.on('agent/created', (payload) => {
    try {
      const agent = payload && payload.agent ? payload.agent : payload;
      const cwd = agent && agent.session && agent.session.meta && agent.session.meta.cwd;
      if (typeof cwd !== 'string' || cwd.length === 0) return;
      if (inspected.has(cwd)) return;

      const report = scanWorkspace(cwd);
      agents.set(cwd, agent);

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

      // Speak up when the score is low, or when there is something concrete to
      // suggest. A single lockfile can leave the score near 80 and still be the
      // one thing worth telling the agent to skip.
      const hasSuggestions = Array.isArray(report.suggestedAiignore) && report.suggestedAiignore.length > 0;
      if (report.healthScore >= options.healthThreshold && hasSuggestions !== true) return;
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
