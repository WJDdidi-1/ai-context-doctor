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
        tokensHint: 'Token counts are a range, measured on bytes — not a model bill.'
      },
      zh: {
        button: '上下文',
        title: 'AI 上下文报告',
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
        tokensHint: 'Token 是按字节估算的区间，不是账单。'
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
      allow: { marginTop: '6px', border: '1px solid rgba(127,127,127,0.35)', background: 'transparent', color: 'inherit', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' },
      note: { opacity: 0.6, fontSize: '11px', marginTop: '12px' }
    };

    function Report() {
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [pending, setPending] = useState(null);
      const t = tr;

      const load = useCallback(() => {
        fetch('/aiignore/report', { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setData(payload);
            setError(null);
          })
          .catch((reason) => setError(reason));
      }, []);

      useEffect(() => {
        load();
      }, [load]);

      const allow = (target) => {
        setPending(target);
        fetch('/aiignore/allow', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: target })
        })
          .then((response) => response.json())
          .then((payload) => {
            if (payload.allowed === true) load();
          })
          .catch(() => setError(new Error('allow-failed')))
          .finally(() => setPending(null));
      };

      if (error !== null) {
        return h('div', null, h('div', { style: styles.title }, t('title')), h('div', { style: styles.meta }, t('allowFailed')));
      }

      if (data === null) {
        return h('div', { style: styles.title }, t('loading'));
      }

      if (!data.workspace) {
        return h('div', null, h('div', { style: styles.title }, t('title')), h('div', { style: styles.meta }, t('empty')));
      }

      const scanned = data.scanned || {};
      const rows = (data.skipped || []).map((item) =>
        h('div', { key: item.path, style: styles.row },
          h('div', { style: styles.path }, item.path),
          h('div', { style: styles.meta }, `${formatBytes(item.bytes)} · ${item.reason} · ${item.attempts} ${t('attempts')}`),
          h('button', { type: 'button', style: styles.allow, disabled: pending === item.path, onClick: () => allow(item.path) }, t('allow'))
        )
      );

      const ignore = (target) => {
        setPending(target);
        fetch('/aiignore/ignore', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: target })
        })
          .then((response) => response.json())
          .then((payload) => {
            if (payload.ignored === true) load();
          })
          .catch(() => setError(new Error('ignore-failed')))
          .finally(() => setPending(null));
      };

      const reads = (data.reads || []).slice().sort((a, b) => b.bytes - a.bytes);
      const visible = reads.slice(0, 8);
      const hidden = reads.length - visible.length;
      const readRows = visible.map((item) =>
        h('div', { key: item.path, style: styles.row },
          h('div', { style: styles.path }, item.path),
          h('div', { style: styles.meta }, `${formatBytes(item.bytes)} · ${t(`verdict${item.verdict.charAt(0).toUpperCase()}${item.verdict.slice(1)}`)}`),
          h('button', { type: 'button', style: styles.allow, disabled: pending === item.path, onClick: () => ignore(item.path) }, t('ignore'))
        )
      );

      return h('div', null,
        h('div', { style: styles.title }, t('title')),
        h('div', { style: styles.meta }, data.workspace),
        h('div', { style: styles.grid },
          h('div', { style: styles.cell }, h('div', { style: styles.label }, t('score')), h('div', { style: styles.value }, typeof scanned.healthScore === 'number' ? `${scanned.healthScore}/100` : '—')),
          h('div', { style: styles.cell }, h('div', { style: styles.label }, t('noise')), h('div', { style: styles.value }, typeof scanned.noisePercent === 'number' ? `${scanned.noisePercent}%` : '—')),
          h('div', { style: styles.cell }, h('div', { style: styles.label }, t('saved')), h('div', { style: styles.value }, formatTokens(data.savedTokens)))
        ),
        h('div', { style: styles.label }, t('skippedTitle')),
        rows.length > 0 ? rows : h('div', { style: styles.meta }, t('skippedNone')),
        h('div', { style: { ...styles.label, marginTop: '14px' } }, `${t('readsTitle')} · ${reads.length} · ${t('readsSpent')} ${formatTokens(data.readTokens)}`),
        readRows.length > 0 ? readRows : h('div', { style: styles.meta }, t('readsNone')),
        hidden > 0 ? h('div', { style: styles.meta }, `+${hidden} ${t('more')}`) : null,
        h('div', { style: styles.note }, data.policy === 'deny' ? t('policyDeny') : t('policyOff')),
        h('div', { style: styles.note }, t('tokensHint'))
      );
    }

    function Dock() {
      const [open, setOpen] = useState(false);
      const label = tr('button');
      return h(React.Fragment, null,
        h('button', { type: 'button', style: styles.button, onClick: () => setOpen((value) => !value) }, label),
        open
          ? h('div', { style: styles.overlay },
              h('div', { style: styles.header },
                h('span', null),
                h('button', { type: 'button', style: styles.close, onClick: () => setOpen(false) }, '×')
              ),
              h(Report, null)
            )
          : null
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            ctx.locale.register(NS, COPY);
            translate = ctx.locale.bind(NS);
          }
        } catch {
          // No locale service: the panel falls back to its English strings.
        }

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({ name: 'conversation.composer.dock', id: 'dsh-aiignore:report', order: 5 }, Dock)
        );
      }
    };
  }
});
