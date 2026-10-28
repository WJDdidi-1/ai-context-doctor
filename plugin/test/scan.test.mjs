import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { apply } from '../index.js';

function tempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-scan-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app.js'), 'export const a = 1;\n');
  return root;
}

function fakeResponse() {
  return {
    status: 0,
    body: '',
    headers: {},
    writeHead(status) {
      this.status = status;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    }
  };
}

function fakeRequest({ method = 'GET', url = '/', origin } = {}) {
  const request = new EventEmitter();
  request.method = method;
  request.url = url;
  request.headers = { host: '127.0.0.1:1234' };
  if (origin !== undefined) request.headers.origin = origin;
  return request;
}

/**
 * A host that has the registries mounted but never emitted agent/created —
 * which is what a bundle sees when the event travels a branch it is not on.
 */
function harness(services = {}) {
  const routes = new Map();
  const ctx = {
    tools: { guard() { return () => {}; } },
    webServer: {
      register(route) {
        routes.set(route.path, route.handler);
        return () => routes.delete(route.path);
      }
    },
    on() {},
    inject(deps, callback) {
      if (deps.every((dep) => ctx[dep] !== undefined)) callback(ctx);
    }
  };
  for (const [name, value] of Object.entries(services)) ctx[name] = value;
  apply(ctx, {});
  return { routes, ctx };
}

/** Apply against a ctx that already carries the registries. */
function harnessWith(services) {
  const routes = new Map();
  const ctx = {
    tools: { guard() { return () => {}; } },
    webServer: {
      register(route) {
        routes.set(route.path, route.handler);
        return () => routes.delete(route.path);
      }
    },
    on() {},
    inject(deps, callback) {
      if (deps.every((dep) => ctx[dep] !== undefined)) callback(ctx);
    },
    ...services
  };
  apply(ctx, {});
  return { routes, ctx };
}

const workspaceOf = (root) => ({ list: () => [{ session: { meta: { cwd: root } } }] });

test('the report resolves the workspace from the registries when no event arrived', () => {
  const root = tempWorkspace();
  const { routes } = harnessWith({ agents: workspaceOf(root) });

  const response = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest({ url: '/aiignore/report' }), response);
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.workspace, root);
  assert.ok(body.scanned.healthScore >= 0);
});

test('the tree route works without an event too', () => {
  const root = tempWorkspace();
  const { routes } = harnessWith({ agents: workspaceOf(root) });

  const response = fakeResponse();
  routes.get('/aiignore/tree')(fakeRequest({ url: '/aiignore/tree' }), response);
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.workspace, root);
  assert.ok(body.entries.some((entry) => entry.name === 'src'));
});

test('the session registry is a fallback when agents cannot answer', () => {
  const root = tempWorkspace();
  const { routes } = harnessWith({ sessions: workspaceOf(root) });

  const response = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest({ url: '/aiignore/report' }), response);
  assert.equal(JSON.parse(response.body).workspace, root);
});

test('scan answers with a fresh report and refuses other methods', () => {
  const root = tempWorkspace();
  const { routes } = harnessWith({ agents: workspaceOf(root) });

  const response = fakeResponse();
  routes.get('/aiignore/scan')(fakeRequest({ method: 'POST', url: '/aiignore/scan' }), response);
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.workspace, root);
  assert.equal(body.scannedFiles >= 1, true);

  const wrongMethod = fakeResponse();
  routes.get('/aiignore/scan')(fakeRequest({ url: '/aiignore/scan' }), wrongMethod);
  assert.equal(wrongMethod.status, 405);

  const crossOrigin = fakeResponse();
  routes.get('/aiignore/scan')(fakeRequest({ method: 'POST', url: '/aiignore/scan', origin: 'http://evil.example' }), crossOrigin);
  assert.equal(crossOrigin.status, 403);
});

test('scan re-reads the tree instead of replaying the first result', () => {
  const root = tempWorkspace();
  const { routes } = harnessWith({ agents: workspaceOf(root) });

  const first = fakeResponse();
  routes.get('/aiignore/scan')(fakeRequest({ method: 'POST', url: '/aiignore/scan' }), first);
  const before = JSON.parse(first.body).scannedFiles;

  fs.writeFileSync(path.join(root, 'src', 'later.js'), 'export const b = 2;\n');

  const second = fakeResponse();
  routes.get('/aiignore/scan')(fakeRequest({ method: 'POST', url: '/aiignore/scan' }), second);
  assert.equal(JSON.parse(second.body).scannedFiles, before + 1);
});

test('scan says so when the conversation has no workspace yet', () => {
  const { routes } = harnessWith({});
  const response = fakeResponse();
  routes.get('/aiignore/scan')(fakeRequest({ method: 'POST', url: '/aiignore/scan' }), response);
  assert.equal(response.status, 404);
  assert.equal(JSON.parse(response.body).error, 'no-workspace');
});
