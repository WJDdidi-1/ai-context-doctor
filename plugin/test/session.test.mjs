import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { apply, activeSession, activeWorkspace, workspaceForSession } from '../index.js';

process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-home-'));

function home() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-home-'));
}

/** Write one session directory with a log whose mtime is the given minute. */
function session(root, folder, id, minute) {
  const dir = path.join(root, 'sessions', `--${folder}--`, `session-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  const log = path.join(dir, 'session.v4.jsonl.zstd');
  fs.writeFileSync(log, 'x');
  const stamp = new Date(2026, 0, 1, 12, minute, 0);
  fs.utimesSync(log, stamp, stamp);
  return dir;
}

function workspaceStore(root, entries) {
  fs.mkdirSync(path.join(root, 'storages'), { recursive: true });
  const tables = { workspaces: {} };
  entries.forEach((entry, index) => {
    tables.workspaces[`w${index}`] = { path: entry.path, title: entry.title, sessionIds: entry.sessions };
  });
  fs.writeFileSync(path.join(root, 'storages', 'workspace.json'), JSON.stringify({ tables }));
}

test('the active session is the one whose log was written last', () => {
  const root = home();
  session(root, 'Projects', 'old', 1);
  session(root, 'Projects', 'new', 40);

  const found = activeSession(root);
  assert.equal(found.id, 'session-new');
});

test('an empty store resolves to nothing rather than guessing', () => {
  assert.equal(activeSession(home()), null);
  assert.equal(activeWorkspace(home()), undefined);
});

test('a session maps to the folder its workspace lists it in', () => {
  const root = home();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-ws-'));
  workspaceStore(root, [{ path: project, title: 'Projects', sessions: ['session-new', 'session-old'] }]);

  assert.equal(workspaceForSession('session-new', root), project);
  assert.equal(workspaceForSession('session-stranger', root), undefined);
});

test('a workspace folder that no longer exists is not offered', () => {
  const root = home();
  workspaceStore(root, [{ path: path.join(root, 'gone'), title: 'Gone', sessions: ['session-new'] }]);

  assert.equal(workspaceForSession('session-new', root), undefined);
});

test('the conversation in front decides the workspace, end to end', () => {
  const root = home();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-ws-'));
  session(root, 'Projects', 'new', 40);
  workspaceStore(root, [{ path: project, title: 'Projects', sessions: ['session-new'] }]);

  assert.equal(activeWorkspace(root), project);
});

test('the overview scans every known folder and remembers the answer', async () => {
  const root = home();
  const noisy = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-noise-'));
  fs.mkdirSync(path.join(noisy, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(noisy, 'dist', 'bundle.js'), 'x'.repeat(200000));
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-clean-'));
  fs.writeFileSync(path.join(clean, 'index.js'), 'export const a = 1;\n');
  workspaceStore(root, [
    { path: noisy, title: 'noisy', sessions: ['session-a'] },
    { path: clean, title: 'clean', sessions: ['session-b'] }
  ]);

  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = root;
  try {
    const routes = new Map();
    const ctx = {
      on() {},
      effect() {},
      inject(deps, callback) {
        if (deps.every((dep) => ctx[dep] !== undefined)) callback(ctx);
      },
      webServer: {
        register(route) {
          routes.set(route.path, route.handler);
          return () => routes.delete(route.path);
        }
      }
    };
    apply(ctx, {});

    const first = await call(routes.get('/aiignore/overview'));
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.workspaces.map((entry) => entry.title).sort(), ['clean', 'noisy']);
    const bad = first.body.workspaces.find((entry) => entry.title === 'noisy');
    assert.ok(bad.healthScore < 50, `noisy folder should score low, got ${bad.healthScore}`);
    assert.equal(bad.noise.length > 0, true);

    // A second call must not rescan: the mtime of the noisy bundle is fixed, so a
    // new measurement would report the same numbers anyway — the timestamp is the
    // observable difference.
    const second = await call(routes.get('/aiignore/overview'));
    assert.deepEqual(second.body.workspaces, first.body.workspaces);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
});

function call(handler) {
  assert.equal(typeof handler, 'function', 'the overview route is registered');
  return new Promise((resolve) => {
    const request = new EventEmitter();
    request.method = 'GET';
    request.url = '/aiignore/overview';
    request.headers = {};
    const response = {
      status: 0,
      body: '',
      setHeader() {},
      writeHead(status) { this.status = status; },
      end(payload) { this.body = payload; resolve({ status: this.status, body: JSON.parse(payload) }); }
    };
    handler(request, response);
  });
}
