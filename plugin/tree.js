import fs from 'node:fs';
import path from 'node:path';
import { classifyPath, estimateTokens, matchesAiignore } from 'ai-context-doctor';

/** Directories a file manager never needs to page into. */
const HIDDEN = new Set(['.git']);

/** One page of a directory listing. Deep folders stay bounded. */
const MAX_ENTRIES = 200;

/**
 * Turn a requested directory into a path inside the workspace.
 *
 * Returns `null` for anything that would step outside it — the browser half is
 * a network client, so the path it sends is untrusted input.
 *
 * @param {string} root Absolute workspace root.
 * @param {string} requested Directory the client asked for, relative to root.
 * @returns {{ absolute: string, relative: string } | null}
 */
export function resolveDirectory(root, requested) {
  const normalized = String(requested === undefined || requested === null ? '' : requested)
    .split(path.sep).join('/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (normalized.split('/').some((part) => part === '..')) return null;
  const absolute = path.resolve(root, normalized);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (absolute !== root && !absolute.startsWith(rootWithSep)) return null;
  return { absolute, relative: normalized };
}

/**
 * What the file manager shows for one path.
 *
 * The verdict is the scanner's own classification, so the tree and the report
 * can never disagree about what counts as noise.
 *
 * @param {{ root: string, relative: string, type: 'dir' | 'file', bytes: number, rules: unknown[], state: object }} input
 */
function describe({ root, relative, type, bytes, rules, state }) {
  // A directory is noise when its own name is, which the classifier only sees
  // through a path below it.
  const classified = type === 'dir' ? classifyPath(`${relative}/`, 0) : classifyPath(relative, bytes);
  const skipped = state !== undefined ? state.skipped.get(relative) : undefined;
  const read = state !== undefined ? state.reads.get(relative) : undefined;

  let badge = type === 'dir' ? 'dir' : 'source';
  let reason = '';
  if (classified.noise !== undefined) {
    badge = 'noise';
    reason = classified.noise.reason;
  } else if (classified.review !== undefined) {
    badge = 'review';
    reason = classified.review.reason;
  }

  return {
    name: relative.split('/').pop(),
    path: relative,
    type,
    bytes,
    badge,
    reason,
    // `matchesAiignore` returns the rule that matched (or undefined); the panel
    // only needs to know whether one did.
    ignored: Boolean(matchesAiignore(rules, relative)),
    allowed: state !== undefined ? state.allowed.has(relative) : false,
    read: read !== undefined,
    blocked: skipped !== undefined,
    tries: skipped !== undefined ? skipped.attempts : 0,
    tokens: type === 'file' ? estimateTokens(bytes) : undefined
  };
}

/**
 * One directory, classified for the panel.
 *
 * @param {{ root: string, dir?: string, rules?: unknown[], state?: object }} input
 * @returns {object} `{ dir, parent, entries, truncated }` or `{ error }`.
 */
export function listDirectory({ root, dir = '', rules = [], state }) {
  const target = resolveDirectory(root, dir);
  if (target === null) return { error: 'outside-workspace' };

  let dirents;
  try {
    dirents = fs.readdirSync(target.absolute, { withFileTypes: true });
  } catch {
    return { error: 'not-a-directory' };
  }

  const entries = [];
  for (const dirent of dirents) {
    if (HIDDEN.has(dirent.name)) continue;
    const relative = target.relative === '' ? dirent.name : `${target.relative}/${dirent.name}`;
    const type = dirent.isDirectory() ? 'dir' : 'file';
    let bytes = 0;
    if (type === 'file') {
      try {
        bytes = fs.statSync(path.join(target.absolute, dirent.name)).size;
      } catch {
        bytes = 0;
      }
    }
    entries.push(describe({ root, relative, type, bytes, rules, state }));
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    if (a.type === 'dir') return a.name.localeCompare(b.name);
    return b.bytes - a.bytes;
  });

  const truncated = entries.length > MAX_ENTRIES;
  const parent = target.relative === '' ? null : target.relative.split('/').slice(0, -1).join('/');

  return {
    dir: target.relative,
    parent,
    entries: truncated ? entries.slice(0, MAX_ENTRIES) : entries,
    truncated,
    total: entries.length
  };
}
