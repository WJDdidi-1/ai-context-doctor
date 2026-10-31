/**
 * The panel, driven the way a user drives it.
 *
 * These went in after fifteen releases of testing this file by regex: the
 * source guards could say "the string heroQuietLine is present" but not "the
 * button still works". `dsh-plugin-toolkit/testkit` mounts the real bundle in
 * Node with the ledger the host provides, so the assertions below are about
 * behaviour.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createFetch, mountClient } from 'dsh-plugin-toolkit/testkit';

import { createWorkspaceState, buildReport } from '../report.js';
import { scanRepository } from '../../lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientFile = path.join(here, '..', 'client.js');
const workspace = path.join(here, '..', '..', 'demo-ai-context-noise-repo');

async function realReport() {
  const state = createWorkspaceState();
  state.report = await scanRepository(workspace, { level: 3 });
  return buildReport({ cwd: workspace, state, policy: 3 });
}

function routes(report, overrides = {}) {
  return {
    '/aiignore/report': { body: report },
    '/aiignore/tree': { body: { dir: workspace, entries: [], parent: null } },
    '/aiignore/conversation': {
      body: {
        id: 'session-test',
        title: 'A conversation',
        cwd: workspace,
        turns: 4,
        tokens: { min: 1200, max: 1600 },
        readFiles: 3,
        readBytes: 48_000,
        noiseCount: 0,
        coveredCount: 0,
        coveredTokens: { min: 0, max: 0 },
        stillNoiseTokens: { min: 0, max: 0 },
        covered: [],
        noise: [],
        read: [],
      },
    },
    '/aiignore/conversations': { body: { current: null, conversations: [] } },
    '/aiignore/levels': {
      body: {
        workspace,
        level: 3,
        levels: [1, 2, 3, 4, 5].map((level) => ({ level, label: `L${level}`, note: '', maxBytes: 0, effectiveScore: 40 + level * 8, blockedBytes: 0, rules: 0 })),
      },
    },
    ...overrides,
  };
}

test('the score on screen is the current one, not a before/after pair', async (t) => {
  // The card used to switch between "before" and "after" depending on whether
  // the folder happened to have rules, so two folders answered the same
  // question with different kinds of number. One number now: the score with the
  // rules and the strength in force.
  const report = await realReport();
  const panel = await mountClient({ file: clientFile, fetch: createFetch(routes(report)) });
  t.after(() => panel.unmount());
  assert.match(panel.text(), /Current score/);
  assert.doesNotMatch(panel.text(), /Score before rules/);
  assert.ok(
    panel.text().includes(String(report.scanned.effectiveScore)),
    `the current score (${report.scanned.effectiveScore}) should be on screen: ${panel.text().slice(0, 200)}`,
  );
  assert.equal(panel.queryAll('[role="tab"]').length, 3);
});

test('the panel asks for the conversation it belongs to, not the newest one', async (t) => {
  // Switching conversations does not write a log, so the host's "newest file"
  // guess keeps answering with the conversation the user just left. The slot
  // knows the id; the panel has to say it.
  const report = await realReport();
  const stub = createFetch(routes(report));
  const panel = await mountClient({
    file: clientFile,
    fetch: stub,
    props: { sessionId: 'session-abc' },
  });
  t.after(() => panel.unmount());
  const asked = stub.calls('/aiignore/conversation');
  assert.ok(asked.length > 0, 'the panel should read the conversation');
  assert.equal(asked[0].search, '?session=session-abc');
});

test('without a session id the panel still asks, and lets the host answer', async (t) => {
  const report = await realReport();
  const stub = createFetch(routes(report));
  const panel = await mountClient({ file: clientFile, fetch: stub });
  t.after(() => panel.unmount());
  assert.equal(stub.calls('/aiignore/conversation')[0].search, '');
});

test('the tabs answer to the keyboard, not only to the mouse', async (t) => {
  const panel = await mountClient({ file: clientFile, fetch: createFetch(routes(await realReport())) });
  t.after(() => panel.unmount());
  const first = panel.must('#aicd-tab-protect');
  first.focus();
  await panel.press('#aicd-tab-protect', 'ArrowRight');
  const panelId = panel.must('[role="tabpanel"]').getAttribute('id');
  assert.equal(panelId, 'aicd-view-files');
  assert.equal(panel.must('[role="tabpanel"]').getAttribute('aria-labelledby'), 'aicd-tab-files');
});

test('the folder menu opens, closes on Escape, and gives focus back', async (t) => {
  const panel = await mountClient({ file: clientFile, fetch: createFetch(routes(await realReport())) });
  t.after(() => panel.unmount());
  assert.equal(panel.query('[role="menu"]'), null);
  await panel.click('[data-aicd-menu-btn]');
  assert.notEqual(panel.query('[role="menu"]'), null);
  await panel.press('[role="menu"]', 'Escape');
  assert.equal(panel.query('[role="menu"]'), null);
  assert.equal(panel.document.activeElement?.getAttribute('data-aicd-menu-btn'), 'true');
});

test('Optimize posts once, then the score on screen is the one that came back', async (t) => {
  const report = await realReport();
  const better = { ...report, rules: ['dist/'], scanned: { ...report.scanned, effectiveScore: 96, effectiveLost: 4, effectiveBreakdown: report.scanned.effectiveBreakdown } };
  // After the write, every read of the report returns the new rules — that is
  // what the host does, and a stub that keeps answering the old payload would
  // hide whether the panel picks the new one up.
  let current = report;
  const stub = createFetch(
    routes(report, {
      '/aiignore/report': () => ({ body: current }),
      '/aiignore/optimize': () => {
        current = better;
        return { body: { added: ['dist/'], written: true, before: report.scanned.healthScore, after: better.scanned.effectiveScore, report: better } };
      },
    }),
  );
  const panel = await mountClient({ file: clientFile, fetch: stub });
  t.after(() => panel.unmount());
  const button = panel.must('[data-wide="true"]');
  assert.match(button.textContent, /Optimize/i);
  await panel.click('[data-wide="true"]');
  assert.equal(stub.calls('/aiignore/optimize').length, 1, 'Optimize should post exactly once');
  assert.match(panel.text(), /96/, panel.text().slice(0, 300));
});
