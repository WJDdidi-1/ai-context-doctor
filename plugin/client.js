/**
 * Browser half: one button in the composer dock, and a panel that only exists
 * after the user clicks it.
 *
 * It talks to the Host half over same-origin HTTP (`/aiignore/report`,
 * `/aiignore/allow`), which is the only channel a third-party bundle has: the
 * generated `ctx.remote.*` namespaces belong to first-party packages.
 */
window.__ModuleLoader__.load({
  id: 'dsh-aiignore',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback } = React;

    const NS = 'dsh-aiignore';
    // Replaced by apply() with the locale-bound translator. A language switch
    // takes effect the next time the panel opens, which keeps this half free of
    // a re-render subscription it cannot test.
    let translate = (key) => key;
    const tr = (key) => {
      try {
        return translate(key);
      } catch {
        return key;
      }
    };
    const COPY = {
      en: {
        button: 'Context',
        title: 'AI context report',
        menuFiles: 'Files',
        menuInsights: 'Insights',
        sessionTitle: 'Files this session touched',
        sessionNone: 'Nothing yet — files show up here as the session reads or writes them.',
        kindRead: 'read',
        kindWritten: 'written',
        kindUseful: 'source',
        kindReview: 'review',
        allFiles: 'Browse the workspace',
        close: 'Close',
        loading: 'Reading this workspace…',
        empty: 'No workspace scanned in this session yet.',
        score: 'Health',
        noise: 'Noise',
        saved: 'Kept out of context',
        skippedTitle: 'Reads that were skipped',
        skippedNone: 'Nothing skipped yet.',
        readsTitle: 'Read into this session',
        readsNone: 'Nothing read yet.',
        readsSpent: 'spent',
        verdictUseful: 'source',
        verdictReview: 'review',
        verdictAllowed: 'you allowed it',
        more: 'more',
        allow: 'Read it anyway',
        ignore: 'Never read it',
        allowFailed: 'Could not allow this file.',
        allowedNow: 'Allowed — the next read goes through.',
        attempts: 'tries',
        policyDeny: 'Default policy: reads of generated output, lockfiles, logs and huge files are refused.',
        policyOff: 'Policy is off: the plugin only warns at session start.',
        tokensHint: 'Token counts are a range, measured on bytes — not a model bill.',
        crumbRoot: 'Workspace',
        emptyDir: 'This folder is empty.',
        truncated: 'Listing truncated — open a subfolder.',
        pickHint: 'Pick a file to see what reading it would cost.',
        badgeSource: 'source',
        badgeNoise: 'noise',
        badgeReview: 'review',
        badgeDir: 'folder',
        badgeIgnored: 'in .aiignore',
        sizeLabel: 'Size',
        tokensLabel: 'Reading it',
        readOnce: 'Read once',
        statusRead: 'read in this session',
        statusBlocked: 'blocked',
        up: 'Up',
      },
      zh: {
        button: '上下文',
        title: 'AI 上下文报告',
        menuFiles: '文件管理',
        menuInsights: '数据分析',
        sessionTitle: '本次会话碰过的文件',
        sessionNone: '还没有——会话读取或写入文件后会出现在这里。',
        kindRead: '已读取',
        kindWritten: '已生成',
        kindUseful: '源码',
        kindReview: '需留意',
        allFiles: '浏览工作区',
        close: '关闭',
        loading: '正在读取工作区…',
        empty: '本次会话还没有扫描任何工作区。',
        score: '健康度',
        noise: '噪音占比',
        saved: '已挡在上下文之外',
        skippedTitle: '被拦下的读取',
        skippedNone: '暂时没有拦截记录。',
        readsTitle: '已读入本次会话',
        readsNone: '还没有读取记录。',
        readsSpent: '已用',
        verdictUseful: '源码',
        verdictReview: '需留意',
        verdictAllowed: '你放行的',
        more: '更多',
        allow: '仍要读取',
        ignore: '以后都别读',
        allowFailed: '无法放行这个文件。',
        allowedNow: '已放行——下次读取会正常进行。',
        attempts: '次尝试',
        policyDeny: '默认策略：构建产物、锁文件、日志、超大文件的读取会被拒绝。',
        policyOff: '策略已关闭：插件只在会话开始时提醒。',
        tokensHint: 'Token 是按字节估算的区间，不是账单。',
        crumbRoot: '工作区',
        emptyDir: '这个文件夹是空的。',
        truncated: '列表已截断，请进入子文件夹。',
        pickHint: '选择一个文件，看看读取它要花多少 token。',
        badgeSource: '源码',
        badgeNoise: '噪音',
        badgeReview: '需留意',
        badgeDir: '文件夹',
        badgeIgnored: '已在 .aiignore',
        sizeLabel: '大小',
        tokensLabel: '读取开销',
        readOnce: '读一次',
        statusRead: '本次会话已读',
        statusBlocked: '已拦截',
        up: '上一级',
      }
    };

    function formatBytes(bytes) {
      if (typeof bytes !== 'number') return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatTokens(range) {
      if (range === undefined || typeof range.min !== 'number') return '0';
      const min = range.min.toLocaleString();
      const max = range.max.toLocaleString();
      return min === max ? `~${min}` : `~${min}–${max}`;
    }

    const styles = {
      button: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '28px',
        padding: '0 10px',
        borderRadius: '14px',
        border: '1px solid var(--border-color, rgba(127,127,127,0.35))',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: '12px',
        cursor: 'pointer'
      },
      overlay: {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        width: '380px',
        maxHeight: '60vh',
        overflowY: 'auto',
        zIndex: 1000,
        borderRadius: '12px',
        border: '1px solid rgba(127,127,127,0.35)',
        background: 'var(--panel-background, #1b1b1f)',
        color: 'var(--panel-foreground, #f2f2f2)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        padding: '14px',
        fontSize: '12px',
        lineHeight: '1.5'
      },
      header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
      title: { fontWeight: 600, fontSize: '13px' },
      close: { border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '12px', opacity: 0.7 },
      grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', margin: '10px 0 14px' },
      cell: { border: '1px solid rgba(127,127,127,0.25)', borderRadius: '8px', padding: '8px' },
      label: { opacity: 0.6, fontSize: '11px' },
      value: { fontSize: '15px', fontWeight: 600, marginTop: '2px' },
      row: { borderTop: '1px solid rgba(127,127,127,0.2)', padding: '8px 0' },
      path: { fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' },
      meta: { opacity: 0.65, fontSize: '11px', marginTop: '2px' },
      wide: { width: '620px', maxWidth: 'calc(100vw - 40px)' },
      body: { display: 'flex', gap: '10px', marginTop: '8px' },
      list: { flex: 1, minWidth: 0, maxHeight: '46vh', overflowY: 'auto', borderTop: '1px solid rgba(127,127,127,0.2)' },
      detail: { width: '200px', flexShrink: 0, borderLeft: '1px solid rgba(127,127,127,0.2)', paddingLeft: '10px' },
      crumb: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: 0.8, marginTop: '6px' },
      crumbButton: { border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: '0 2px', textDecoration: 'underline' },
      rowButton: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', padding: '5px 4px', border: 'none', borderRadius: '6px', background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' },
      rowActive: { background: 'rgba(127,127,127,0.18)' },
      dot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, display: 'inline-block' },
      name: { fontSize: '12px' },
      action: { marginTop: '8px', display: 'block', width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-color, rgba(127,127,127,0.35))', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: '11px', cursor: 'pointer' },
      allow: { marginTop: '6px', border: '1px solid rgba(127,127,127,0.35)', background: 'transparent', color: 'inherit', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' },
      note: { opacity: 0.6, fontSize: '11px', marginTop: '12px' },
      menu: { position: 'absolute', bottom: '34px', left: 0, zIndex: 1001, minWidth: '132px', padding: '4px', borderRadius: '10px', border: '1px solid rgba(127,127,127,0.35)', background: 'var(--panel-background, #1b1b1f)', color: 'var(--panel-foreground, #f2f2f2)', boxShadow: '0 8px 20px rgba(0,0,0,0.35)' },
      menuItem: { display: 'block', width: '100%', padding: '6px 10px', border: 'none', borderRadius: '6px', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: '12px', textAlign: 'left', cursor: 'pointer' },
      sectionTitle: { fontWeight: 600, fontSize: '12px', marginTop: '4px' }
    };

    function Report({ view }) {
      const [data, setData] = useState(null);
      const [tree, setTree] = useState(null);
      const [at, setAt] = useState('');
      const [selected, setSelected] = useState(null);
      const [error, setError] = useState(null);
      const [pending, setPending] = useState(null);
      const t = tr;

      const loadSummary = useCallback(() => {
        fetch('/aiignore/report', { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setData(payload);
            setError(null);
          })
          .catch((reason) => setError(reason));
      }, []);

      const loadTree = useCallback((dir) => {
        fetch(`/aiignore/tree?dir=${encodeURIComponent(dir)}`, { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setTree(payload);
            setError(null);
          })
          .catch((reason) => setError(reason));
      }, []);

      useEffect(() => {
        loadSummary();
      }, [loadSummary]);

      useEffect(() => {
        if (view !== 'files') return;
        loadTree(at);
      }, [at, view, loadTree]);

      const post = (route, target, done) => {
        setPending(target);
        fetch(route, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: target })
        })
          .then((response) => response.json())
          .then((payload) => {
            if (done(payload)) {
              loadTree(at);
              loadSummary();
            }
          })
          .catch(() => setError(new Error('post-failed')))
          .finally(() => setPending(null));
      };

      const allow = (target) => post('/aiignore/allow', target, (payload) => payload.allowed === true);
      const ignore = (target) => post('/aiignore/ignore', target, (payload) => payload.ignored === true);

      if (error !== null) {
        return h('div', { style: styles.meta }, t('allowFailed'));
      }

      if (data === null) {
        return h('div', { style: styles.meta }, t('loading'));
      }

      const scanned = data.scanned || {};
      const dot = { noise: '#e0a33a', review: '#6f9fe0', dir: '#9a9a9a', source: '#4ea36b', written: '#c77ddc' };
      const badgeLabel = (entry) => {
        if (entry.ignored === true) return t('badgeIgnored');
        if (entry.type === 'dir') return t('badgeDir');
        if (entry.badge === 'noise') return `${t('badgeNoise')} · ${entry.reason}`;
        if (entry.badge === 'review') return t('badgeReview');
        return t('badgeSource');
      };

      const detail = selected === null
        ? h('div', { style: styles.meta }, t('pickHint'))
        : h('div', null,
            h('div', { style: styles.path }, selected.name || selected.path),
            h('div', { style: styles.meta }, selected.path),
            selected.badge !== undefined ? h('div', { style: styles.meta }, badgeLabel(selected)) : null,
            h('div', { style: { ...styles.meta, marginTop: '8px' } }, `${t('sizeLabel')} · ${formatBytes(selected.bytes)}`),
            h('div', { style: styles.meta }, `${t('tokensLabel')} · ${formatTokens(selected.tokens)}`),
            selected.read === true ? h('div', { style: styles.meta }, t('statusRead')) : null,
            selected.blocked === true ? h('div', { style: styles.meta }, `${t('statusBlocked')} ${selected.tries}×`) : null,
            h('button', { type: 'button', style: styles.action, disabled: pending === selected.path, onClick: () => allow(selected.path) }, t('readOnce')),
            h('button', { type: 'button', style: styles.action, disabled: pending === selected.path, onClick: () => ignore(selected.path) }, t('ignore'))
          );

      const metrics = h('div', { style: styles.grid },
        h('div', { style: styles.cell }, h('div', { style: styles.label }, t('score')), h('div', { style: styles.value }, typeof scanned.healthScore === 'number' ? `${scanned.healthScore}/100` : '—')),
        h('div', { style: styles.cell }, h('div', { style: styles.label }, t('noise')), h('div', { style: styles.value }, typeof scanned.noisePercent === 'number' ? `${scanned.noisePercent}%` : '—')),
        h('div', { style: styles.cell }, h('div', { style: styles.label }, t('saved')), h('div', { style: styles.value }, formatTokens(data.savedTokens)))
      );

      const skippedRows = (data.skipped || []).map((item) =>
        h('div', { key: item.path, style: styles.row },
          h('div', { style: styles.path }, item.path),
          h('div', { style: styles.meta }, `${formatBytes(item.bytes)} · ${item.reason} · ${item.attempts} ${t('attempts')}`),
          h('button', { type: 'button', style: styles.allow, disabled: pending === item.path, onClick: () => allow(item.path) }, t('allow'))
        )
      );
      const readRows = (data.reads || []).map((item) =>
        h('div', { key: item.path, style: styles.row },
          h('div', { style: styles.path }, item.path),
          h('div', { style: styles.meta }, `${formatBytes(item.bytes)} · ${t(item.verdict === 'review' ? 'verdictReview' : item.verdict === 'allowed' ? 'verdictAllowed' : 'verdictUseful')}`),
          h('button', { type: 'button', style: styles.allow, disabled: pending === item.path, onClick: () => ignore(item.path) }, t('ignore'))
        )
      );

      if (view === 'insights') {
        return h('div', null,
          data.workspace ? h('div', { style: styles.meta }, data.workspace) : null,
          metrics,
          h('div', { style: styles.sectionTitle }, t('skippedTitle')),
          skippedRows.length > 0 ? skippedRows : h('div', { style: styles.meta }, t('skippedNone')),
          h('div', { style: styles.sectionTitle }, t('readsTitle')),
          readRows.length > 0 ? readRows : h('div', { style: styles.meta }, t('readsNone')),
          h('div', { style: styles.note }, data.policy === 'deny' ? t('policyDeny') : t('policyOff')),
          h('div', { style: styles.note }, t('tokensHint'))
        );
      }

      const sessionFiles = (data.sessionFiles || []).slice(0, 8).map((item) =>
        h('button', {
          key: item.path,
          type: 'button',
          style: selected !== null && selected.path === item.path ? { ...styles.rowButton, ...styles.rowActive } : styles.rowButton,
          onClick: () => setSelected({ ...item, name: item.path.split('/').pop() })
        },
          h('span', { style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 } },
            h('span', { style: { ...styles.dot, background: dot[item.kind === 'written' ? 'written' : item.kind === 'review' ? 'review' : 'source'] } }),
            h('span', { style: { ...styles.name, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.path),
            h('span', { style: styles.meta }, t(item.kind === 'written' ? 'kindWritten' : item.kind === 'review' ? 'kindReview' : 'kindRead'))
          ),
          h('span', { style: styles.meta }, formatBytes(item.bytes))
        )
      );

      const sessionSection = h('div', null,
        h('div', { style: styles.sectionTitle }, t('sessionTitle')),
        sessionFiles.length > 0 ? sessionFiles : h('div', { style: styles.meta }, t('sessionNone'))
      );

      const crumbs = [];
      const parts = at === '' ? [] : at.split('/');
      crumbs.push(h('button', { key: 'root', type: 'button', style: styles.crumbButton, onClick: () => { setAt(''); setSelected(null); } }, t('crumbRoot')));
      parts.forEach((part, index) => {
        const target = parts.slice(0, index + 1).join('/');
        crumbs.push(h('span', { key: `sep${index}` }, '/'));
        crumbs.push(h('button', { key: target, type: 'button', style: styles.crumbButton, onClick: () => { setAt(target); setSelected(null); } }, part));
      });

      const entries = tree === null ? [] : (tree.entries || []);
      const rows = entries.map((entry) =>
        h('button', {
          key: entry.path,
          type: 'button',
          style: selected !== null && selected.path === entry.path ? { ...styles.rowButton, ...styles.rowActive } : styles.rowButton,
          onClick: () => {
            if (entry.type === 'dir') {
              setAt(entry.path);
              setSelected(null);
            } else {
              setSelected({ ...entry, name: entry.name });
            }
          }
        },
          h('span', { style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 } },
            h('span', { style: { ...styles.dot, background: dot[entry.ignored === true ? 'dir' : entry.badge] || dot.source } }),
            h('span', { style: { ...styles.name, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, entry.name),
            entry.type === 'dir' ? h('span', { style: styles.meta }, '›') : null
          ),
          h('span', { style: styles.meta }, entry.type === 'dir' ? '' : formatBytes(entry.bytes))
        )
      );

      return h('div', null,
        data.workspace ? h('div', { style: styles.meta }, data.workspace) : null,
        sessionSection,
        h('div', { style: { ...styles.sectionTitle, marginTop: '12px' } }, t('allFiles')),
        h('div', { style: styles.crumb }, crumbs),
        h('div', { style: styles.body },
          h('div', { style: styles.list },
            rows.length > 0 ? rows : h('div', { style: styles.meta }, t('emptyDir')),
            tree !== null && tree.truncated === true ? h('div', { style: styles.meta }, t('truncated')) : null
          ),
          h('div', { style: styles.detail }, detail)
        ),
        h('div', { style: styles.note }, t('tokensHint'))
      );
    }

    // A folder, drawn inline so the button needs no asset request and inherits
    // the composer's current text color in both themes.
    function FolderIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, style: { display: 'block' } },
        h('path', {
          d: 'M1.5 4.2c0-.7.6-1.2 1.2-1.2h3.1l1.3 1.5h6.2c.7 0 1.2.6 1.2 1.2v6.1c0 .7-.6 1.2-1.2 1.2H2.7c-.7 0-1.2-.6-1.2-1.2V4.2Z',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round'
        })
      );
    }

    function Dock() {
      const [open, setOpen] = useState(false);
      const [view, setView] = useState('files');
      const [hover, setHover] = useState(false);
      const label = tr('button');
      const pick = (next) => {
        setView(next);
        setOpen(true);
        setHover(false);
      };
      return h(React.Fragment, null,
        h('span', {
          style: { position: 'relative', display: 'inline-flex' },
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false)
        },
          h('button', { type: 'button', style: styles.button, title: label, 'aria-label': label, onClick: () => setOpen((value) => !value) },
            h(FolderIcon, null)
          ),
          hover && open === false
            ? h('div', { style: styles.menu },
                h('button', { type: 'button', style: styles.menuItem, onClick: () => pick('files') }, tr('menuFiles')),
                h('button', { type: 'button', style: styles.menuItem, onClick: () => pick('insights') }, tr('menuInsights'))
              )
            : null
        ),
        open
          ? h('div', { style: { ...styles.overlay, ...styles.wide } },
              h('div', { style: styles.header },
                h('span', null, `${tr('title')} · ${tr(view === 'files' ? 'menuFiles' : 'menuInsights')}`),
                h('button', { type: 'button', style: styles.close, onClick: () => setOpen(false) }, '×')
              ),
              h(Report, { view })
            )
          : null
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            ctx.locale.register(NS, COPY);
            translate = ctx.locale.bind(NS);
          }
        } catch {
          // No locale service: the panel falls back to its English strings.
        }

        // `conversation.input.left` is the row that holds the add-files button,
        // so the panel entry sits beside it instead of below the composer.
        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register({ name: 'conversation.input.left', id: 'dsh-aiignore:report', order: 20 }, Dock)
        );
      }
    };
  }
});
