import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { apply } from '../index.js';
import { createWorkspaceState, recordSkip, allowPath, savedTokens, buildReport } from '../report.js';

function tempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-ui-'));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'app.js'), 'x'.repeat(12000));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app.js'), 'export const a = 1;\n');
  return root;
}

function fakeResponse() {
  return {
    status: 0,
    body: '',
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      this.body = body;
    }
  };
}

function fakeRequest({ method = 'GET', url = '/', body } = {}) {
  const request = new EventEmitter();
  request.method = method;
  request.url = url;
  request.headers = { host: '127.0.0.1:1234' };
  if (body !== undefined) {
    request.setEncoding = () => {};
    process.nextTick(() => {
      request.emit('data', body);
      request.emit('end');
    });
  }
  return request;
}

/** Capture the routes apply() registers, without a real Harness or server. */
function harness() {
  const routes = new Map();
  const listeners = new Map();
  const guards = [];
  const ctx = {
    tools: { guard(guard) { guards.push(guard); } },
    webServer: {
      register(route) {
        routes.set(route.path, route.handler);
        return () => routes.delete(route.path);
      }
    },
    on(name, listener) {
      listeners.set(name, listener);
    }
  };
  apply(ctx, {});
  return { routes, listeners, guards };
}

test('a skipped read is recorded once per path and counted on repeats', () => {
  const state = createWorkspaceState();
  recordSkip(state, { relativePath: 'dist/app.js', bytes: 100, reason: 'generated build output' });
  recordSkip(state, { relativePath: 'dist/app.js', bytes: 100, reason: 'generated build output' });

  const [entry] = buildReport({ cwd: '/w', state, policy: 'deny' }).skipped;
  assert.equal(entry.attempts, 2);
  assert.equal(entry.path, 'dist/app.js');
});

test('allowing a path removes it from the skipped list', () => {
  const state = createWorkspaceState();
  recordSkip(state, { relativePath: 'dist/app.js', bytes: 100, reason: 'generated build output' });

  assert.equal(allowPath(state, 'dist/app.js'), true);
  assert.equal(allowPath(state, 'nope.js'), false);
  assert.deepEqual(buildReport({ cwd: '/w', state, policy: 'deny' }).skipped, []);
});

test('saved tokens cover the bytes of every skipped read', () => {
  const state = createWorkspaceState();
  recordSkip(state, { relativePath: 'a.js', bytes: 3080, reason: 'large file' });
  recordSkip(state, { relativePath: 'b.js', bytes: 4320, reason: 'large file' });

  const saved = savedTokens(state);
  assert.equal(saved.bytes, 7400);
  assert.ok(saved.min > 0 && saved.max >= saved.min);
});

test('report handler answers with the scanned workspace, then the allow route edits it', async () => {
  const { routes, listeners, guards } = harness();
  assert.deepEqual([...routes.keys()].sort(), ['/aiignore/allow', '/aiignore/report']);

  const root = tempWorkspace();
  const agent = { session: { meta: { cwd: root } }, inject() {} };
  listeners.get('agent/created')({ agent });

  // The guard records one refused read of generated output.
  const denial = guards[0]({ name: 'read', arguments: { file_path: path.join(root, 'dist', 'app.js') }, agent });
  assert.match(String(denial), /Skipped dist\/app\.js/);

  const first = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest(), first);
  const payload = JSON.parse(first.body);
  assert.equal(payload.workspace, root);
  assert.equal(typeof payload.scanned.healthScore, 'number');
  assert.equal(payload.skipped.length, 1);

  const second = fakeResponse();
  await new Promise((resolve) => {
    const request = fakeRequest({ method: 'POST', body: JSON.stringify({ path: 'dist/app.js' }) });
    second.end = (body) => {
      second.body = body;
      resolve();
    };
    routes.get('/aiignore/allow')(request, second);
  });
  assert.equal(JSON.parse(second.body).allowed, true);

  const third = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest(), third);
  assert.deepEqual(JSON.parse(third.body).skipped, []);

  fs.rmSync(root, { recursive: true, force: true });
});

test('report handler refuses non-GET and unknown workspaces answer with null', () => {
  const { routes } = harness();
  const rejected = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest({ method: 'POST' }), rejected);
  assert.equal(rejected.status, 405);

  const empty = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest(), empty);
  assert.equal(JSON.parse(empty.body).workspace, null);
});
