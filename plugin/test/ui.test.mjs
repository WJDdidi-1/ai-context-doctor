import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { apply, decideRead, inspectRead } from '../index.js';
import { createWorkspaceState, recordSkip, recordRead, allowPath, savedTokens, buildReport } from '../report.js';

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

test('the ledger separates what was read from what was refused', () => {
  const state = createWorkspaceState();
  recordRead(state, { relativePath: 'src/app.js', bytes: 100, verdict: 'useful' });
  recordRead(state, { relativePath: 'src/app.js', bytes: 100, verdict: 'useful' });
  recordRead(state, { relativePath: 'scripts/deploy.sh', bytes: 50, verdict: 'review' });

  const report = buildReport({ cwd: '/w', state, policy: 'deny' });
  assert.equal(report.reads.length, 2);
  assert.equal(report.reads.find((item) => item.path === 'src/app.js').attempts, 2);
  assert.ok(report.readTokens.min > 0);
});

test('report handler answers with the scanned workspace, then the allow route edits it', async () => {
  const { routes, listeners, guards } = harness();
  assert.deepEqual([...routes.keys()].sort(), ['/aiignore/allow', '/aiignore/ignore', '/aiignore/report']);

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

  // The retry the user just authorised: the same read now goes through.
  const retry = guards[0]({ name: 'read', arguments: { file_path: path.join(root, 'dist', 'app.js') }, agent });
  assert.equal(retry, undefined);

  const third = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest(), third);
  const afterAllow = JSON.parse(third.body);
  assert.deepEqual(afterAllow.skipped, []);
  assert.equal(afterAllow.reads.find((item) => item.path === 'dist/app.js').verdict, 'allowed');

  // A file the guard never blocks is still counted, so the panel can show what
  // the session spent as well as what it saved.
  guards[0]({ name: 'read', arguments: { file_path: path.join(root, 'src', 'app.js') }, agent });
  const fourth = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest(), fourth);
  const last = JSON.parse(fourth.body);
  assert.equal(last.reads.find((item) => item.path === 'src/app.js').verdict, 'useful');

  fs.rmSync(root, { recursive: true, force: true });
});

test('a rule in .aiignore refuses a file the heuristic would pass', () => {
  const root = tempWorkspace();
  fs.writeFileSync(path.join(root, '.aiignore'), 'src/app.js\n');
  fs.writeFileSync(path.join(root, 'src', 'generated.js'), 'export const g = 1;\n');
  fs.writeFileSync(path.join(root, '.aiignore'), 'src/generated.js\n');

  const inspected = inspectRead({ root, filePath: path.join(root, 'src', 'generated.js') });
  assert.equal(inspected.inside, true);

  const decision = decideRead({ root, filePath: path.join(root, 'src', 'generated.js'), policy: 'deny', rules: ['src/generated.js'] });
  assert.equal(decision.block, true);
  assert.equal(decision.reason, 'listed in .aiignore');

  const clean = decideRead({ root, filePath: path.join(root, 'src', 'app.js'), policy: 'deny', rules: ['src/generated.js'] });
  assert.equal(clean.block, false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('the ignore route records the decision in .aiignore', async () => {
  const { routes, listeners } = harness();
  const root = tempWorkspace();
  const agent = { session: { meta: { cwd: root } }, inject() {} };
  listeners.get('agent/created')({ agent });

  const response = fakeResponse();
  await new Promise((resolve) => {
    const request = fakeRequest({ method: 'POST', body: JSON.stringify({ path: path.join(root, 'src', 'app.js') }) });
    response.end = (body) => {
      response.body = body;
      resolve();
    };
    routes.get('/aiignore/ignore')(request, response);
  });

  const payload = JSON.parse(response.body);
  assert.equal(payload.ignored, true);
  assert.equal(payload.rule, 'src/app.js');
  assert.match(fs.readFileSync(path.join(root, '.aiignore'), 'utf8'), /^src\/app\.js$/m);

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
