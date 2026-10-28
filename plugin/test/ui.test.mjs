import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { apply, decideRead, inspectRead, readNotes, writeNotes, recentUploads, NOTES_FILE } from '../index.js';
import { createWorkspaceState, recordSkip, recordRead, recordWrite, allowPath, savedTokens, buildReport, sessionFiles } from '../report.js';

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
  const deferred = [];
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
    },
    // Mirrors cordis: a dependency that is already mounted starts the child
    // plugin immediately, which is the path a real Harness takes when the
    // services exist before this plugin.
    inject(deps, callback) {
      if (deps.every((dep) => ctx[dep] !== undefined)) callback(ctx);
      else deferred.push({ deps, callback });
    }
  };
  apply(ctx, {});
  return { routes, listeners, guards, deferred, ctx };
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
  assert.deepEqual([...routes.keys()].sort(), ['/aiignore/allow', '/aiignore/ignore', '/aiignore/notes', '/aiignore/report', '/aiignore/tree']);

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

test('a service that mounts late still gets the routes and the guard', async () => {
  // A headless profile has no web server; the panel must not depend on it, and a
  // web server that appears after this plugin still gets the routes.
  const { webServer } = { webServer: undefined };
  const late = harness();
  void webServer;

  // Rebuild a context without services, then hand them over the way cordis does.
  const routes = new Map();
  const guards = [];
  const deferred = [];
  const ctx = {
    on() {},
    inject(deps, callback) {
      deferred.push({ deps, callback });
    }
  };
  apply(ctx, {});

  assert.equal(deferred.length, 2, 'both services are awaited');
  assert.equal(routes.size, 0);

  ctx.tools = { guard(guard) { guards.push(guard); } };
  ctx.webServer = { register(route) { routes.set(route.path, route.handler); return () => {}; } };
  for (const entry of deferred) entry.callback(ctx);

  assert.equal(guards.length, 1, 'the guard installs once the tool registry appears');
  assert.deepEqual([...routes.keys()].sort(), ['/aiignore/allow', '/aiignore/ignore', '/aiignore/notes', '/aiignore/report', '/aiignore/tree']);
  assert.equal(late.routes.size, 5, 'a context with both services installs eagerly');
});

test('the tree route lists the scanned workspace, one directory at a time', () => {
  const { routes, listeners } = harness();
  const root = tempWorkspace();
  listeners.get('agent/created')({ agent: { session: { meta: { cwd: root } }, inject() {} } });

  const response = fakeResponse();
  routes.get('/aiignore/tree')(fakeRequest({ url: '/aiignore/tree?dir=' }), response);
  const listing = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(listing.workspace, root);
  assert.deepEqual(listing.entries.map((entry) => entry.name).slice(0, 2), ['dist', 'src']);

  const nested = fakeResponse();
  routes.get('/aiignore/tree')(fakeRequest({ url: '/aiignore/tree?dir=src' }), nested);
  assert.deepEqual(JSON.parse(nested.body).entries.map((entry) => entry.name), ['app.js']);

  const escaped = fakeResponse();
  routes.get('/aiignore/tree')(fakeRequest({ url: '/aiignore/tree?dir=..' }), escaped);
  assert.equal(escaped.status, 400);
  assert.equal(JSON.parse(escaped.body).error, 'outside-workspace');
});

test('the allow route can pre-approve a file the session never tried', async () => {
  const { routes, listeners } = harness();
  const root = tempWorkspace();
  listeners.get('agent/created')({ agent: { session: { meta: { cwd: root } }, inject() {} } });

  const response = fakeResponse();
  await new Promise((resolve) => {
    const request = fakeRequest({ method: 'POST', body: JSON.stringify({ path: 'dist/app.js' }) });
    response.end = (body) => {
      response.body = body;
      resolve();
    };
    routes.get('/aiignore/allow')(request, response);
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).allowed, true);

  const report = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest(), report);
  assert.ok(JSON.parse(report.body).allowed.includes('dist/app.js'));
});

test('the session file list merges reads and writes without double counting', () => {
  const state = createWorkspaceState();
  recordRead(state, { relativePath: 'src/app.js', bytes: 100, verdict: 'useful' });
  recordWrite(state, { relativePath: 'src/app.js', bytes: 260 });
  recordWrite(state, { relativePath: 'notes/plan.md', bytes: 40 });

  const files = sessionFiles(state);
  const app = files.find((item) => item.path === 'src/app.js');
  assert.equal(files.length, 2);
  // Written wins the label and the larger size, so the row answers "what did
  // this session change" rather than "what did it read first".
  assert.equal(app.kind, 'written');
  assert.equal(app.bytes, 260);
  assert.ok(app.tokens.min > 0);
  assert.equal(files[0].path, 'src/app.js');
});

test('a write tool call shows up in the report even when nothing was refused', () => {
  const { routes, listeners, guards } = harness();
  const root = tempWorkspace();
  const agent = { session: { meta: { cwd: root } }, inject() {} };
  listeners.get('agent/created')({ agent });

  const target = path.join(root, 'src', 'app.js');
  const verdict = guards[0]({ name: 'write', arguments: { file_path: target }, agent });
  assert.equal(verdict, undefined);

  const response = fakeResponse();
  routes.get('/aiignore/report')(fakeRequest(), response);
  const payload = JSON.parse(response.body);
  assert.equal(payload.skipped.length, 0);
  const entry = payload.sessionFiles.find((item) => item.path === 'src/app.js');
  assert.equal(entry.kind, 'written');
  assert.equal(payload.writes.length, 1);
});

test('a note round-trips through the workspace, and an empty note deletes the file', () => {
  const root = tempWorkspace();
  assert.equal(readNotes(root), '');

  writeNotes(root, 'Prefer the docs/ folder over src/ when explaining APIs.');
  assert.match(readNotes(root), /Prefer the docs/);
  assert.ok(fs.existsSync(path.join(root, NOTES_FILE)));

  writeNotes(root, '   ');
  assert.equal(readNotes(root), '');
  assert.equal(fs.existsSync(path.join(root, NOTES_FILE)), false);
});

test('the note route saves the text and pushes it to the running agent', async () => {
  const { routes, listeners } = harness();
  const root = tempWorkspace();
  const injected = [];
  const agent = { session: { meta: { cwd: root } }, inject: (payload) => injected.push(payload) };
  listeners.get('agent/created')({ agent });
  injected.length = 0;

  const response = fakeResponse();
  routes.get('/aiignore/notes')(fakeRequest({ method: 'POST', url: '/aiignore/notes', body: JSON.stringify({ text: 'Say hello in Chinese.' }) }), response);
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(JSON.parse(response.body).injected, true);
  assert.match(readNotes(root), /Say hello in Chinese/);
  assert.equal(injected.length, 1);
  assert.match(injected[0].content[0].text, /Say hello in Chinese/);

  const read = fakeResponse();
  routes.get('/aiignore/notes')(fakeRequest({ method: 'GET', url: '/aiignore/notes' }), read);
  assert.match(JSON.parse(read.body).notes, /Say hello in Chinese/);
});

test('uploads are filtered by arrival time and typed from their magic bytes', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-home-'));
  const bucket = path.join(home, 'attachments', 'v1', 'objects', 'ab');
  fs.mkdirSync(bucket, { recursive: true });
  const png = path.join(bucket, 'ab'.repeat(32));
  fs.writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]));
  const old = path.join(bucket, 'cd'.repeat(32));
  fs.writeFileSync(old, Buffer.from([0x25, 0x50, 0x44, 0x46, 1, 2, 3, 4]));
  const past = new Date(Date.now() - 3600_000);
  fs.utimesSync(old, past, past);

  const uploads = recentUploads(Date.now() - 60_000, home);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].type, 'png');
  assert.equal(uploads[0].bytes, 12);
  assert.equal(uploads[0].name.length, 8);
});

test('a note left in the workspace reaches the next session without a click', () => {
  const { listeners } = harness();
  const root = tempWorkspace();
  writeNotes(root, 'This repo talks to Stripe; never print keys.');
  const injected = [];
  const agent = { session: { meta: { cwd: root } }, inject: (payload) => injected.push(payload) };

  listeners.get('agent/created')({ agent });
  const notes = injected.find((item) => /Stripe/.test(item.content[0].text));
  assert.ok(notes, 'the note should be injected at session start');
});
