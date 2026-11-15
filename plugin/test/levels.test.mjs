import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-home-'));

import { apply } from '../index.js';
import { scanRepository, parseRules } from 'ai-context-doctor';

function tempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-levels-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'index.js'), 'export const a = 1;\n');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'x'.repeat(80 * 1024));
  fs.writeFileSync(path.join(root, 'package-lock.json'), 'y'.repeat(6000));
  fs.writeFileSync(path.join(root, 'dev.log'), 'z'.repeat(3000));
  return root;
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

test('the strength preview answers five questions from one walk, and agrees with five scans', async () => {
  const root = tempWorkspace();
  const { routes } = harness();

  await call(routes, 'POST', `/aiignore/scan?cwd=${encodeURIComponent(root)}`);
  const levels = await call(routes, 'GET', `/aiignore/levels?cwd=${encodeURIComponent(root)}`);

  assert.equal(levels.status, 200);
  assert.equal(levels.body.levels.length, 5);
  assert.deepEqual(
    levels.body.levels.map((entry) => entry.level),
    [1, 2, 3, 4, 5]
  );

  const rules = [];
  for (const entry of levels.body.levels) {
    const alone = scanRepository(root, { rules, level: entry.level });
    assert.equal(entry.effectiveScore, alone.effectiveScore, `level ${entry.level} score`);
    assert.equal(entry.blockedFiles, alone.blockedFiles, `level ${entry.level} blocked files`);
    assert.equal(entry.files, alone.scannedFiles, `level ${entry.level} file count`);
  }

  // The scale has to actually move, otherwise the table is decoration.
  const scores = levels.body.levels.map((entry) => entry.effectiveScore);
  assert.ok(scores.at(-1) > scores[0], `${JSON.stringify(scores)} should climb`);
});

test('a folder with rules already applied still previews every strength', async () => {
  const root = tempWorkspace();
  fs.writeFileSync(path.join(root, '.aiignore'), 'dist/\n');
  const { routes } = harness();

  await call(routes, 'POST', `/aiignore/scan?cwd=${encodeURIComponent(root)}`);
  const levels = await call(routes, 'GET', `/aiignore/levels?cwd=${encodeURIComponent(root)}`);
  const rules = parseRules('dist/\n');

  assert.equal(levels.status, 200);
  for (const entry of levels.body.levels) {
    const alone = scanRepository(root, { rules, level: entry.level });
    assert.equal(entry.effectiveScore, alone.effectiveScore, `level ${entry.level} with a rule`);
  }
});
