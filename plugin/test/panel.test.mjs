import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const clientSource = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');

/** Just enough React for the registration path: no component is ever rendered. */
const stubReact = {
  createElement: (type, props) => ({ type, props: props || {} }),
  Fragment: 'fragment',
  useState: () => [null, () => {}],
  useEffect: () => {},
  useCallback: (callback) => callback
};

/** Load client.js the way the Harness does, and hand back its module exports. */
function loadPanel() {
  let definition = null;
  const window = {
    __ModuleLoader__: {
      load(loaded) {
        definition = loaded;
      }
    }
  };
  new Function('window', clientSource)(window);
  assert.notEqual(definition, null, 'client.js never called __ModuleLoader__.load');
  assert.equal(definition.id, 'dsh-aiignore');
  return definition.factory((name) => {
    if (name === 'react') return stubReact;
    throw new Error(`unexpected module ${name}`);
  });
}

/** A context that records what the panel registers, and nothing else. */
function fakeContext({ sidebar = true, slots = true } = {}) {
  const registrations = [];
  const types = [];
  const slotApi = {
    inject(name, register) {
      register();
    },
    register(definition, component) {
      registrations.push({ name: definition.name, key: definition.id || definition.key, component });
      return () => {};
    }
  };
  const ctx = {
    locale: { register() {}, bind: () => (key) => key },
    effect: (run) => run()
  };
  if (slots) ctx.slots = slotApi;
  ctx.inject = (deps, callback) => {
    if (!sidebar) return;
    callback({
      slots: slotApi,
      effect: (run) => run(),
      sidebarRightTabs: {
        register(definition) {
          types.push(definition);
          return () => {};
        }
      },
      sidebarRight: { openTab() {} }
    });
  };
  return { ctx, registrations, types };
}

test('the panel registers a sidebar tab with a guide entry', () => {
  const { ctx, types } = fakeContext();
  const panel = loadPanel();
  panel.apply(ctx);

  assert.equal(types.length, 1);
  const [type] = types;
  assert.equal(type.id, 'dsh-aiignore');
  assert.equal(type.kind, 'ai-context');
  assert.equal(typeof type.title, 'function');
  assert.equal(type.guide.length, 1);
  assert.equal(type.guide[0].id, 'report');
  assert.equal(typeof type.guide[0].order, 'number');
});

test('the tab body, the tab title and the composer entry are all registered', () => {
  const { ctx, registrations } = fakeContext();
  loadPanel().apply(ctx);

  const names = registrations.map((entry) => entry.name).sort();
  assert.deepEqual(names, [
    'conversation.input.left',
    'main',
    'sidebar.panellist',
    'sidebar.right.pane.tab',
    'sidebar.right.pane.tab.title'
  ]);
  for (const entry of registrations) {
    assert.equal(typeof entry.component, 'function', `${entry.name} has no component`);
  }
});

test('the entry survives a host without a sidebar', () => {
  const { ctx, registrations, types } = fakeContext({ sidebar: false });
  assert.doesNotThrow(() => loadPanel().apply(ctx));
  assert.deepEqual(types, [], 'no tab type without the sidebar services');
  // The summary page lives in the left navigation, which exists without a right
  // sidebar; only the tab type and the composer entry depend on those services.
  assert.deepEqual(registrations.map((entry) => entry.name).sort(), ['conversation.input.left', 'main', 'sidebar.panellist']);
});

test('a host without slots at all does not break the plugin', () => {
  const { ctx, registrations } = fakeContext({ slots: false, sidebar: false });
  assert.doesNotThrow(() => loadPanel().apply(ctx));
  assert.deepEqual(registrations, []);
});

test('the module asks for slots and takes the sidebar lazily', () => {
  const panel = loadPanel();
  assert.deepEqual(panel.inject, ['slots', 'locale']);
});
