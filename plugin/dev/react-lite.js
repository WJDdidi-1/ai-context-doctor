/* A ~200-line React stand-in, enough to run the real panel in dev/preview.html.
 *
 * It re-renders whole trees instead of reconciling them, which is fine for a
 * developer preview and keeps the file honest: no virtual-DOM diffing, no keys,
 * no context, no portals. Hooks keep their state in a path-keyed map, so state
 * survives a re-render because the component's position in the tree does.
 *
 * Props handled: className, style (object), value/checked (properties), events
 * (onClick, onChange -> input, onMouseEnter/Leave), and any other prop as an
 * attribute. Focus and caret position survive a re-render.
 */

(function () {
  const Fragment = Symbol('fragment');
  const SVG_TAGS = new Set(['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text', 'defs']);
  const slots = new Map();
  const effects = [];
  const cleanups = new Map();
  const roots = [];

  let currentPath = '';
  let hookIndex = 0;
  let scheduled = false;

  function createElement(type, props) {
    const merged = Object.assign({}, props || {});
    const children = Array.prototype.slice.call(arguments, 2);
    if (children.length > 0) merged.children = children.length === 1 ? children[0] : children;
    return { type: type, props: merged };
  }

  function slotFor(key) {
    if (!slots.has(key)) slots.set(key, {});
    return slots.get(key);
  }

  function useState(initial) {
    const key = currentPath + '#' + hookIndex++;
    const slot = slotFor(key);
    if (!('value' in slot)) slot.value = typeof initial === 'function' ? initial() : initial;
    const setValue = function (next) {
      const resolved = typeof next === 'function' ? next(slot.value) : next;
      if (Object.is(resolved, slot.value)) return;
      slot.value = resolved;
      schedule();
    };
    return [slot.value, setValue];
  }

  function useCallback(callback, deps) {
    const key = currentPath + '#cb' + hookIndex++;
    const slot = slotFor(key);
    const changed =
      !('deps' in slot) ||
      !Array.isArray(deps) ||
      deps.length !== slot.deps.length ||
      deps.some(function (item, index) { return !Object.is(item, slot.deps[index]); });
    if (changed) {
      slot.deps = deps === undefined ? [] : deps;
      slot.value = callback;
    }
    return slot.value;
  }

  function useEffect(run, deps) {
    const key = currentPath + '#fx' + hookIndex++;
    const slot = slotFor(key);
    const changed =
      !('deps' in slot) ||
      deps === undefined ||
      !Array.isArray(deps) ||
      deps.length !== slot.deps.length ||
      deps.some(function (item, index) { return !Object.is(item, slot.deps[index]); });
    if (changed) {
      slot.deps = deps === undefined ? undefined : deps;
      effects.push({
        key: key,
        run: function () {
          if (cleanups.has(key)) cleanups.get(key)();
          const cleanup = run();
          if (typeof cleanup === 'function') cleanups.set(key, cleanup);
          else cleanups.delete(key);
        }
      });
    }
  }

  function useRef(initial) {
    const key = currentPath + '#ref' + hookIndex++;
    const slot = slotFor(key);
    if (!('value' in slot)) slot.value = (initial === undefined) ? { current: null } : { current: initial };
    return slot.value;
  }

  function setAttribute(el, name, value) {
    if (value === undefined || value === null || value === false) return;
    if (name === 'className') return void el.setAttribute('class', value);
    if (name === 'style') {
      Object.keys(value).forEach(function (key) {
        el.style[key] = value[key];
      });
      return;
    }
    if (name === 'children' || name === 'key') return;
    if (/^on[A-Z]/.test(name)) return;
    if (name === 'value' || name === 'checked' || name === 'disabled') return;
    if (value === true) return void el.setAttribute(name, '');
    el.setAttribute(name, String(value));
  }

  function bindEvents(el, props) {
    Object.keys(props).forEach(function (name) {
      if (!/^on[A-Z]/.test(name)) return;
      const handler = props[name];
      if (typeof handler !== 'function') return;
      const event = name === 'onChange' ? 'input' : name.slice(2).toLowerCase();
      el.addEventListener(event, function (nativeEvent) {
        if (name === 'onChange') {
          handler({ target: { value: nativeEvent.target.value } });
          return;
        }
        handler(nativeEvent);
      });
    });
  }

  function renderNode(vnode, path) {
    if (vnode === null || vnode === undefined || vnode === false || vnode === true) {
      return document.createComment('');
    }
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      return document.createTextNode(String(vnode));
    }
    if (Array.isArray(vnode)) {
      const fragment = document.createDocumentFragment();
      vnode.forEach(function (child, index) {
        fragment.appendChild(renderNode(child, path + '.' + index));
      });
      return fragment;
    }

    const type = vnode.type;
    const props = vnode.props || {};

    if (type === Fragment) return renderNode(props.children, path);

    if (typeof type === 'function') {
      const outerPath = currentPath;
      const outerIndex = hookIndex;
      // The component's own name is part of the key: two different components
      // can occupy the same tree position (a tab switch), and their hook state
      // must not be shared.
      currentPath = path + '@' + (type.name || 'anonymous');
      hookIndex = 0;
      let rendered;
      try {
        rendered = type(props);
      } finally {
        currentPath = outerPath;
        hookIndex = outerIndex;
      }
      return renderNode(rendered, path + '>');
    }

    const el = SVG_TAGS.has(type)
      ? document.createElementNS('http://www.w3.org/2000/svg', type)
      : document.createElement(type);
    el.setAttribute('data-preview-path', path);
    Object.keys(props).forEach(function (name) {
      if (name === 'children' || name === 'value' || name === 'checked' || name === 'ref') return;
      setAttribute(el, name, props[name]);
    });
    bindEvents(el, props);
    if (props.ref && typeof props.ref === 'object' && 'current' in props.ref) props.ref.current = el;

    const children = props.children;
    if (children !== undefined && children !== null) {
      const list = Array.isArray(children) ? children : [children];
      list.forEach(function (child, index) {
        el.appendChild(renderNode(child, path + '>' + index));
      });
    }

    if ('value' in props && props.value !== undefined && props.value !== null) el.value = props.value;
    if ('checked' in props) el.checked = props.checked === true;
    if (props.disabled === true) el.disabled = true;
    return el;
  }

  function snapshotFocus() {
    const active = document.activeElement;
    if (active === null || active === undefined || typeof active.getAttribute !== 'function') return null;
    const path = active.getAttribute('data-preview-path');
    if (path === null) return null;
    const snapshot = { path: path };
    try {
      if (typeof active.selectionStart === 'number') {
        snapshot.start = active.selectionStart;
        snapshot.end = active.selectionEnd;
      }
    } catch {
      // inputs without selection support
    }
    return snapshot;
  }

  function restoreFocus(snapshot) {
    if (snapshot === null) return;
    const el = document.querySelector('[data-preview-path="' + snapshot.path + '"]');
    if (el === null || typeof el.focus !== 'function') return;
    el.focus();
    if (snapshot.start !== undefined && typeof el.setSelectionRange === 'function') {
      try {
        el.setSelectionRange(snapshot.start, snapshot.end);
      } catch {
        // element no longer accepts a caret
      }
    }
  }

  function renderAll() {
    const focus = snapshotFocus();
    effects.length = 0;
    roots.forEach(function (root) {
      while (root.container.firstChild) root.container.removeChild(root.container.firstChild);
      currentPath = root.path;
      hookIndex = 0;
      try {
        root.container.appendChild(renderNode(root.vnode, root.path));
      } catch (error) {
        // A throw mid-render used to leave every root blank with no clue why;
        // keep the message where the preview page can show it.
        window.__renderError = error;
        console.error(error);
      }
    });
    const queued = effects.slice();
    queued.forEach(function (effect) {
      effect.run();
    });
    restoreFocus(focus);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(function () {
      scheduled = false;
      renderAll();
    });
  }

  function render(vnode, container, path) {
    roots.push({ vnode: vnode, container: container, path: path || 'root' });
    renderAll();
  }

  window.ReactLite = {
    createElement: createElement,
    Fragment: Fragment,
    useState: useState,
    useEffect: useEffect,
    useCallback: useCallback,
    useRef: useRef,
    render: render,
    rerender: renderAll
  };
})();
