import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// The suggestion path exists because a rule like `dist/` retires forty files
// while `dist/bundle.js` retires one and leaves the next build to be added too.
// These tests pin the two halves of that: what gets suggested, and what the
// write route refuses to write.
process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-home-'));

import { apply } from '../index.js';
import { listDirectory } from '../tree.js';

const CLIENT = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8');

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiignore-suggest-'));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'x'.repeat(4000));
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app.js'), 'export const a = 1;\n');
  return root;
}

function fakeResponse(resolve) {
  return {
    status: 0,
    body: '',
    writeHead(status) {
      this.status = status;
    },
    setHeader() {},
    end(body) {
      this.body = body;
      resolve();
    }
  };
}

function fakeRequest(body) {
  const request = new EventEmitter();
  request.method = 'POST';
  request.headers = { host: '127.0.0.1:1234' };
  request.setEncoding = () => {};
  process.nextTick(() => {
    request.emit('data', body);
    request.emit('end');
  });
  return request;
}

async function routesFor(root) {
  const routes = new Map();
  const listeners = new Map();
  apply({
    locale: { register() {}, bind: () => (key) => key },
    inject: (deps, callback) => {
      if (Array.isArray(deps) && deps.includes('webServer')) {
        callback({ webServer: { register: (route) => routes.set(route.path, route.handler) } });
      }
    },
    on: (event, handler) => listeners.set(event, handler),
    slots: { register: () => {}, inject: () => {} },
    tools: { register: () => {} }
  });
  listeners.get('agent/created')({ agent: { session: { meta: { cwd: root } }, inject() {} } });
  return routes;
}

async function post(handler, body) {
  let payload = null;
  await new Promise((resolve) => {
    const response = fakeResponse(resolve);
    response.end = (text) => {
      payload = JSON.parse(text);
      resolve();
    };
    handler(fakeRequest(JSON.stringify(body)), response);
  });
  return payload;
}

test('a listing suggests the widest rule that covers a noise file', () => {
  const root = workspace();
  const listing = listDirectory({ root, rules: [] });
  const byName = new Map(listing.entries.map((entry) => [entry.name, entry]));

  assert.equal(byName.get('dist').suggestion, 'dist/');
  assert.equal(byName.get('package-lock.json').suggestion, 'package-lock.json');
  // Source is not noise, so there is nothing to suggest for it.
  assert.equal(byName.get('src').suggestion, null);

  // A rule that already covers the file means no suggestion: proposing what is
  // already written teaches the reader that the hint is noise.
  const covered = listDirectory({ root, rules: ['dist/'] });
  assert.equal(covered.entries.find((entry) => entry.name === 'dist').suggestion, null);

  fs.rmSync(root, { recursive: true, force: true });
});

test('the rule route writes a glob, and refuses anything that is not one', async () => {
  const root = workspace();
  const routes = await routesFor(root);
  const add = routes.get('/aiignore/rules');
  assert.equal(typeof add, 'function');

  const ok = await post(add, { rule: '*.log' });
  assert.equal(ok.rule, '*.log');
  assert.match(fs.readFileSync(path.join(root, '.aiignore'), 'utf8'), /^\*\.log$/m);

  for (const bad of ['../etc/passwd', '/etc/passwd', 'a b', '', 'x'.repeat(300)]) {
    const refused = await post(add, { rule: bad });
    assert.equal(refused.error !== undefined, true, `should refuse ${JSON.stringify(bad)}`);
  }
  const stillClean = fs.readFileSync(path.join(root, '.aiignore'), 'utf8');
  assert.equal(stillClean.includes('passwd'), false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('the ignore route accepts a wider rule but only when it covers that file', async () => {
  const root = workspace();
  const routes = await routesFor(root);
  const ignore = routes.get('/aiignore/ignore');

  const wide = await post(ignore, { path: path.join(root, 'dist', 'bundle.js'), rule: 'dist/' });
  assert.equal(wide.rule, 'dist/');
  assert.match(fs.readFileSync(path.join(root, '.aiignore'), 'utf8'), /^dist\/$/m);

  const wrong = await post(ignore, { path: path.join(root, 'src', 'app.js'), rule: 'dist/' });
  assert.equal(wrong.error, 'rule-does-not-cover-file');
  // The refusal must not have written the file line either.
  assert.equal(fs.readFileSync(path.join(root, '.aiignore'), 'utf8').includes('src/app.js'), false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('the panel explains its three verdicts and offers the suggested rules', () => {
  // Same reasoning as the other source guards: the copy block is the contract
  // with the reader, and a missing key would render a bare identifier.
  for (const key of ['legendNoise', 'legendReview', 'legendIgnored', 'suggestTitle', 'suggestHint']) {
    assert.equal(CLIENT.includes(`${key}:`), true, `${key} has copy in both languages`);
  }
  assert.equal((CLIENT.match(/legendNoise:/g) || []).length, 2, 'en and zh both define the legend');
  assert.equal(CLIENT.includes('h(Detail, {'), true);
  assert.equal(CLIENT.includes('onIgnore(item.path, undefined, item.suggestion)'), true);
});
