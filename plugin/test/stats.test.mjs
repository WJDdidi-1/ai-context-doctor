import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// Point the session store somewhere empty: nothing here may read the
// developer's own ~/.dsh.
process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-stats-home-'));

import { apply, bumpStats, readStats, STATS_FILE } from '../index.js';
import { buildReport, createWorkspaceState } from '../report.js';

function workspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aicd-stats-'));
}

function fakeResponse() {
  return {
    status: 0,
    body: '',
    writeHead(status) {
      this.status = status;
    },
    setHeader() {},
    end(body) {
      this.body = body;
    }
  };
}

function fakeRequest({ method = 'GET', url = '/' } = {}) {
  const request = new EventEmitter();
  request.method = method;
  request.url = url;
  request.headers = { host: '127.0.0.1:1234' };
  return request;
}

async function call(routes, method, url) {
  const response = fakeResponse();
  routes.get(url.split('?')[0])(fakeRequest({ method, url }), response);
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { status: response.status, body: response.body === '' ? null : JSON.parse(response.body) };
}

function harness() {
  const routes = new Map();
  const deferred = [];
  const ctx = {
    tools: { guard() {} },
    webServer: {
      register(route) {
        routes.set(route.path, route.handler);
        return () => routes.delete(route.path);
      }
    },
    on() {},
    inject(deps, callback) {
      if (deps.every((dep) => ctx[dep] !== undefined)) callback(ctx);
      else deferred.push({ deps, callback });
    }
  };
  apply(ctx, {});
  return { routes, ctx };
}

test('a workspace with no counter file reads as zero, not as an error', () => {
  const cwd = workspace();
  assert.deepEqual(readStats(cwd), { blockedReads: 0, savedTokens: 0, since: null, lastAt: null });
});

test('each refusal raises the counter and keeps the first timestamp', () => {
  const cwd = workspace();

  const first = bumpStats(cwd, { tokens: 1200, at: '2026-10-29T01:00:00.000Z' });
  assert.equal(first.blockedReads, 1);
  assert.equal(first.savedTokens, 1200);
  assert.equal(first.since, '2026-10-29T01:00:00.000Z');

  const second = bumpStats(cwd, { tokens: 800, at: '2026-10-29T02:00:00.000Z' });
  assert.equal(second.blockedReads, 2);
  assert.equal(second.savedTokens, 2000);
  assert.equal(second.since, '2026-10-29T01:00:00.000Z', 'since is the first refusal, not the latest');
  assert.equal(second.lastAt, '2026-10-29T02:00:00.000Z');

  const stored = JSON.parse(fs.readFileSync(path.join(cwd, STATS_FILE), 'utf8'));
  assert.equal(stored.blockedReads, 2);
  assert.equal(stored.savedTokens, 2000);
});

test('a corrupt counter file falls back to zero instead of breaking the panel', () => {
  const cwd = workspace();
  fs.writeFileSync(path.join(cwd, STATS_FILE), 'not json at all');
  assert.deepEqual(readStats(cwd), { blockedReads: 0, savedTokens: 0, since: null, lastAt: null });

  fs.writeFileSync(path.join(cwd, STATS_FILE), '{"blockedReads":"eleven"}');
  assert.equal(readStats(cwd).blockedReads, 0, 'a non-number is not adopted');
});

test('the report carries the counters through to the panel', () => {
  const cwd = workspace();
  bumpStats(cwd, { tokens: 4000, at: '2026-10-29T03:00:00.000Z' });
  const report = buildReport({
    cwd,
    state: createWorkspaceState(),
    policy: 'deny',
    rules: [],
    stats: readStats(cwd)
  });
  assert.equal(report.stats.blockedReads, 1);
  assert.equal(report.stats.savedTokens, 4000);
});

test('the report without counters still answers, with zeros', () => {
  const report = buildReport({ cwd: workspace(), state: createWorkspaceState(), policy: 'deny' });
  assert.deepEqual(report.stats, { blockedReads: 0, savedTokens: 0, since: null, lastAt: null });
});

test('the report offers the next notch only when it would block something new', async () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"x"}');
  // 300 KB of hand-written prose: not noise, allowed at 1 MB, refused at 256 KB.
  fs.writeFileSync(path.join(root, 'long.md'), 'x'.repeat(300 * 1024));

  const { routes } = harness();
  await call(routes, 'POST', `/aiignore/scan?cwd=${encodeURIComponent(root)}`);
  const atThree = await call(routes, 'GET', `/aiignore/report?cwd=${encodeURIComponent(root)}`);

  assert.equal(atThree.status, 200);
  assert.deepEqual(atThree.body.stats, { blockedReads: 0, savedTokens: 0, since: null, lastAt: null });
  assert.equal(atThree.body.potential.level, 4);
  assert.equal(atThree.body.potential.extraFiles, 1);
  assert.ok(atThree.body.potential.extraTokens.min > 0, 'the offer comes with a token estimate');

  // At the strictest notch there is nothing left to offer.
  fs.writeFileSync(path.join(root, '.aiignore.policy.json'), JSON.stringify({ level: 5 }));
  const atFive = await call(routes, 'GET', `/aiignore/report?cwd=${encodeURIComponent(root)}`);
  assert.equal(atFive.body.potential, null);
});

test('a blocked read recorded through the guard counts the scanner range, not NaN', async () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"x"}');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'x'.repeat(4000));

  const { ctx } = harness();
  let guard;
  ctx.tools.guard = (fn) => {
    guard = fn;
  };
  // Re-apply with a guard-collecting ctx so the real handler is exercised.
  const routes = new Map();
  const ctx2 = {
    tools: { guard(fn) { guard = fn; } },
    webServer: { register(route) { routes.set(route.path, route.handler); return () => {}; } },
    on() {},
    inject(deps, callback) { if (deps.every((dep) => ctx2[dep] !== undefined)) callback(ctx2); }
  };
  apply(ctx2, { readPolicy: 'deny' });
  assert.equal(typeof guard, 'function', 'the guard is installed');

  const exec = { name: 'read', arguments: { file_path: path.join(root, 'dist', 'bundle.js') }, agent: { session: { meta: { cwd: root } } } };
  const denial = guard(exec);
  assert.ok(typeof denial === 'string' && denial.indexOf('Skipped') !== -1, String(denial));

  const stats = readStats(root);
  assert.equal(stats.blockedReads, 1);
  assert.ok(stats.savedTokens > 0, `savedTokens should be a count, got ${stats.savedTokens}`);
  assert.equal(Number.isFinite(stats.savedTokens), true);
});
