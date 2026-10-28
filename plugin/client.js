/**
 * Browser half. Two surfaces, one report:
 *
 * - a right-sidebar tab (`kind: 'ai-context'`), which is where the work happens —
 *   it is a real pane, so it has the app's chrome, keyboard, resize and theme;
 * - one button beside the composer's add-files control, which opens that tab.
 *
 * The tab is a page type: it takes no resource address, so it is opened by kind
 * (`ctx.sidebarRight.openTab(KIND)`). When the host has no sidebar services the
 * button falls back to the same panel in a floating container, which keeps the
 * plugin usable — the tab is the preferred surface, not the only one.
 *
 * Data comes from the Host half over same-origin HTTP (`/aiignore/report`,
 * `/aiignore/tree`, `/aiignore/allow`, `/aiignore/ignore`, `/aiignore/notes`):
 * the generated `ctx.remote.*` namespaces belong to first-party packages.
 */
window.__ModuleLoader__.load({
  id: 'dsh-aiignore',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback } = React;

    const NS = 'dsh-aiignore';
    const KIND = 'ai-context';

    let translate = (key) => key;
    const tr = (key) => {
      try {
        return translate(key);
      } catch {
        return key;
      }
    };

    //#region copy
    /** One click inserts a sentence the user would otherwise retype every session. */
    const TEMPLATES = [
      { id: 'entry', labelKey: 'templateEntryLabel', key: 'templateEntry' },
      { id: 'avoid', labelKey: 'templateAvoidLabel', key: 'templateAvoid' },
      { id: 'tests', labelKey: 'templateTestsLabel', key: 'templateTests' }
    ];

    const COPY = {
      en: {
        entry: 'AI context',
        tabTitle: 'AI context',
        guideTitle: 'AI context report',
        guideDesc: 'What this session read, what was blocked, and the note you leave for the agent.',
        score: 'Health',
        scoreHint: 'out of 100',
        noise: 'noise',
        savedLabel: 'kept out',
        blockedBadge: 'blocked',
        refresh: 'Refresh',
        tabFiles: 'Files',
        tabInsights: 'Insights',
        tabNote: 'Note',
        search: 'Filter files…',
        filterAll: 'All',
        filterNoise: 'Noise',
        filterReview: 'Review',
        filterIgnored: 'In .aiignore',
        sessionTitle: 'Touched this session',
        workspaceTitle: 'Workspace',
        up: 'Up',
        filesCount: '{n} files',
        loading: 'Reading this workspace…',
        emptyTitle: 'No workspace yet',
        emptyHint: 'Scan the workspace of this conversation to see what the agent could read here.',
        scanNow: 'Scan this conversation',
        scanFailed: 'The scan did not run. The conversation may not have a workspace yet.',
        webTitle: 'No workspace yet',
        errorTitle: 'Could not read the report',
        errorHint: 'The panel could not reach the plugin server in this window.',
        errorStatus: 'status',
        retry: 'Try again',
        emptyDir: 'This folder is empty.',
        truncated: 'Listing truncated — open a subfolder.',
        noMatch: 'No file matches this filter.',
        sessionNone: 'Nothing yet — files appear here as the session reads or writes them.',
        kindRead: 'read',
        kindWritten: 'written',
        badgeNoise: 'noise',
        badgeReview: 'review',
        badgeSource: 'source',
        badgeIgnored: 'ignored',
        detailSize: 'Size',
        detailCost: 'Reading it',
        detailRead: 'Read in this session',
        detailBlocked: 'Blocked',
        detailAttempts: 'tries',
        detailAllowed: 'You allowed it',
        readOnce: 'Read once',
        neverRead: 'Never read',
        blockedTitle: 'Blocked from context',
        blockedNone: 'Nothing blocked yet.',
        readsTitle: 'Read into this session',
        readsNone: 'Nothing read yet.',
        uploadsTitle: 'Received this session',
        uploadsNone: 'Drop a file into the composer and it appears here.',
        uploadsNote: 'Uploads are stored by content digest, so only the digest and size survive.',
        sortSize: 'Largest first',
        sortName: 'Name',
        batchIgnore: 'Never read {n} files',
        batchClear: 'Clear',
        undoHint: 'Added to .aiignore.',
        undoAction: 'Undo',
        timelineToday: 'Today',
        timelineYesterday: 'Yesterday',
        exportReport: 'Export report (.md)',
        templatesTitle: 'Insert a starting point',
        templateEntryLabel: 'Entry point',
        templateEntry: 'The entry point is src/index.js; start there before reading anything else.',
        templateAvoidLabel: 'What to skip',
        templateAvoid: 'Do not read dist/, build output, lockfiles or logs — they are generated or redundant.',
        templateTestsLabel: 'How to check',
        templateTests: 'Run `npm test` before changing behaviour; it is the fastest signal in this repo.',
        noteTitle: 'A note for the agent',
        noteHint: 'Saved to .aiignore.notes.md in this workspace, and sent to the agent right away.',
        notePlaceholder: 'e.g. Prefer lib/ over legacy/. Never read dist/.',
        noteSave: 'Save and send',
        noteSaved: 'Saved. The agent has it.',
        noteTooLong: 'Too long — keep it under 4000 characters.',
        noteFailed: 'That did not go through. Try again.',
        noteEmpty: 'Empty notes are removed, not saved.',
        policyDeny: 'Default policy: generated output, lockfiles, logs and files over 1 MB are refused.',
        tokensHint: 'Token counts are a byte-based range, not a model bill.',
        close: 'Close',
        verdictAllowed: 'you allowed it'
      },
      zh: {
        entry: '上下文',
        tabTitle: 'AI 上下文',
        guideTitle: 'AI 上下文报告',
        guideDesc: '本次会话读了什么、挡了什么，以及你留给 AI 的说明。',
        score: '健康度',
        scoreHint: '满分 100',
        noise: '噪音',
        savedLabel: '已挡',
        blockedBadge: '项已拦',
        refresh: '刷新',
        tabFiles: '文件',
        tabInsights: '分析',
        tabNote: '说明',
        search: '筛选文件…',
        filterAll: '全部',
        filterNoise: '噪音',
        filterReview: '需留意',
        filterIgnored: '已在 .aiignore',
        sessionTitle: '本次会话碰过',
        workspaceTitle: '工作区',
        up: '上一级',
        filesCount: '{n} 个文件',
        loading: '正在读取工作区…',
        emptyTitle: '还没有工作区',
        emptyHint: '扫描当前对话的工作区，就能看到 AI 在这里会读到什么。',
        scanNow: '扫描当前对话',
        scanFailed: '扫描没有执行。这个对话可能还没有确定工作目录。',
        webTitle: '还没有工作区',
        errorTitle: '读取报告失败',
        errorHint: '面板无法连接插件服务，可能是插件还没加载完成。',
        errorStatus: '状态码',
        retry: '重试',
        emptyDir: '这个文件夹是空的。',
        truncated: '列表被截断——请进入子文件夹。',
        noMatch: '没有符合筛选条件的文件。',
        sessionNone: '还没有——会话读取或写入文件后会出现在这里。',
        kindRead: '已读',
        kindWritten: '已写',
        badgeNoise: '噪音',
        badgeReview: '需留意',
        badgeSource: '源码',
        badgeIgnored: '已忽略',
        detailSize: '大小',
        detailCost: '读入成本',
        detailRead: '本次已读',
        detailBlocked: '已拦截',
        detailAttempts: '次尝试',
        detailAllowed: '你已放行',
        readOnce: '读一次',
        neverRead: '永不读',
        blockedTitle: '挡在上下文之外',
        blockedNone: '暂时没有拦截记录。',
        readsTitle: '已读入本次会话',
        readsNone: '还没有读取记录。',
        uploadsTitle: '本次会话收到',
        uploadsNone: '拖一个文件到输入框，它就会出现在这里。',
        uploadsNote: '上传按内容摘要存储，因此只保留摘要与大小。',
        sortSize: '按大小',
        sortName: '按名称',
        batchIgnore: '批量不再读取（{n}）',
        batchClear: '清除选择',
        undoHint: '已写入 .aiignore。',
        undoAction: '撤销',
        timelineToday: '今天',
        timelineYesterday: '昨天',
        exportReport: '导出报告（.md）',
        templatesTitle: '插入一个开头',
        templateEntryLabel: '入口文件',
        templateEntry: '入口文件是 src/index.js，先读它，再读别的。',
        templateAvoidLabel: '别读什么',
        templateAvoid: '不要读 dist/、构建产物、锁文件和日志——它们是生成的或重复的。',
        templateTestsLabel: '怎么验证',
        templateTests: '改行为前先跑 `npm test`，这是这个仓库里最快的信号。',
        noteTitle: '给 AI 的说明',
        noteHint: '保存到本工作区的 .aiignore.notes.md，并立即发送给 AI。',
        notePlaceholder: '例如：优先用 lib/，不要用 legacy/；永远不要读 dist/。',
        noteSave: '保存并发送',
        noteSaved: '已保存，AI 已收到。',
        noteTooLong: '太长了——请控制在 4000 字以内。',
        noteFailed: '没有成功，请再试一次。',
        noteEmpty: '空内容会被删除，而不是保存。',
        policyDeny: '默认策略：构建产物、锁文件、日志与超过 1 MB 的文件会被拒绝读取。',
        tokensHint: 'token 数是按字节估算的区间，不是模型账单。',
        close: '关闭',
        verdictAllowed: '你已放行'
      }
    };

    // Single source of truth: this text must match ui/panel.css byte for byte.
    //#endregion copy

    //#region styles
    const CSS = String.raw`/*
 * The panel's whole look. Every value comes from the host's design tokens
 * (--dsw-*), so light and dark themes, font-size preferences and radius
 * scales follow the app instead of being re-invented here.
 *
 * This file is the single source of truth: client.js embeds the same text
 * verbatim (a browser bundle cannot import it) and a test fails when the two
 * drift apart. dev/preview.html links this file directly.
 */

.aicd-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, currentColor);
  font: var(--dsw-font-xs-13, 13px/20px system-ui);
  -webkit-font-smoothing: antialiased;
}

/* ---------- header ---------- */

.aicd-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.2));
}

.aicd-head-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.aicd-head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.aicd-title {
  font: var(--dsw-font-xs-strong-13, 500 13px/20px system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-path {
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, monospace);
  color: var(--dsw-alias-label-tertiary, currentColor);
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, currentColor);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.aicd-iconbtn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-iconbtn:active {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.2));
}

/* ---------- summary ---------- */

.aicd-summary {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.aicd-score {
  font: var(--dsw-font-l-20, 500 20px/28px system-ui);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.aicd-score[data-tone="warn"] { color: var(--dsw-alias-state-warn-label, #b7791f); }
.aicd-score[data-tone="bad"] { color: var(--dsw-alias-state-error-primary, #d64545); }
.aicd-score[data-tone="good"] { color: var(--dsw-alias-label-primary, currentColor); }

.aicd-caption {
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-summary-spacer { flex: 1; }

/* ---------- segmented tabs ---------- */

.aicd-tabs {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 2px;
  padding: 2px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1));
}

.aicd-tab {
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: calc(var(--dsw-radius-sm, 8px) - 2px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, currentColor);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aicd-tab:hover { color: var(--dsw-alias-label-primary, currentColor); }

.aicd-tab[aria-selected="true"] {
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, currentColor);
  font-weight: 500;
  box-shadow: var(--dsw-elevation-stroke, 0 0 0 0.5px rgba(0, 0, 0, 0.12));
}

/* ---------- toolbar ---------- */

.aicd-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 8px;
}

.aicd-search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  border-radius: var(--dsw-radius-sm, 8px);
  color: var(--dsw-alias-label-tertiary, currentColor);
  transition: border-color 120ms ease;
}

.aicd-search:focus-within {
  border-color: var(--dsw-alias-state-business-primary, #4176e6);
}

.aicd-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary, currentColor);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui);
}

.aicd-search input::placeholder { color: var(--dsw-alias-label-caption, currentColor); }

.aicd-chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.aicd-chip {
  height: 22px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, currentColor);
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.aicd-chip:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-chip[data-active="true"] {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.18));
  color: var(--dsw-alias-label-primary, currentColor);
  font-weight: 500;
}

.aicd-count {
  margin-left: auto;
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
  font-variant-numeric: tabular-nums;
}

/* ---------- scrolling body ---------- */

.aicd-files {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.aicd-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 8px 18px;
}

.aicd-body::-webkit-scrollbar { width: 10px; }
.aicd-body::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background-clip: content-box;
  background-color: var(--dsw-alias-scrollbar-bg-l1, rgba(127, 127, 127, 0.35));
}
.aicd-body:hover::-webkit-scrollbar-thumb {
  background-color: var(--dsw-alias-scrollbar-hover-l1, rgba(127, 127, 127, 0.5));
}

.aicd-section {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 4px 4px;
}

.aicd-section-title {
  font: var(--dsw-font-xxxs-strong-11, 500 11px/14px system-ui);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-section-note {
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- rows ---------- */

.aicd-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 3px 6px;
  border: none;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-primary, currentColor);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui);
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.aicd-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1)); }
.aicd-row:active { background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.18)); }

.aicd-row[data-selected="true"] {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.18));
  box-shadow: inset 2px 0 0 var(--dsw-alias-state-business-primary, #4176e6);
}

.aicd-row-icon {
  flex: none;
  display: inline-flex;
  color: var(--dsw-alias-label-tertiary, currentColor);
}

.aicd-row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-row-name code {
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 11.5px;
}

.aicd-row-meta {
  flex: none;
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
  font-variant-numeric: tabular-nums;
}

.aicd-row-flags {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ---------- badges & dots ---------- */

.aicd-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 17px;
  padding: 0 6px;
  border-radius: var(--dsw-radius-xs, 4px);
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  font-weight: 500;
  white-space: nowrap;
}

.aicd-badge[data-tone="noise"] {
  background: var(--dsw-alias-state-warn-tertiary, rgba(183, 121, 31, 0.16));
  color: var(--dsw-alias-state-warn-label, #9a6700);
}

.aicd-badge[data-tone="review"] {
  background: var(--dsw-alias-state-business-tertiary, rgba(65, 118, 230, 0.16));
  color: var(--dsw-alias-state-business-primary, #3364cc);
}

.aicd-badge[data-tone="neutral"] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.14));
  color: var(--dsw-alias-label-tertiary, currentColor);
}

.aicd-badge[data-tone="danger"] {
  background: var(--dsw-alias-interactive-bg-hover-danger, rgba(236, 19, 19, 0.1));
  color: var(--dsw-alias-state-error-primary, #d64545);
}

.aicd-dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.6));
}

.aicd-dot[data-status="source"] { background: var(--dsw-alias-state-success-primary, #2f9e44); }
.aicd-dot[data-status="noise"] { background: var(--dsw-alias-state-warn-primary, #d9a406); }
.aicd-dot[data-status="review"] { background: var(--dsw-alias-state-business-primary, #4176e6); }
.aicd-dot[data-status="written"] { background: var(--dsw-alias-label-tertiary, #8b8b8b); }
.aicd-dot[data-status="blocked"] { background: var(--dsw-alias-state-error-primary, #d64545); }

/* ---------- cards ---------- */

.aicd-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 4px 4px 0;
}

.aicd-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.2));
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, transparent);
}

.aicd-card-value {
  font: var(--dsw-font-m-18, 500 16px/28px system-ui);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.aicd-card-label {
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- buttons ---------- */

.aicd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, currentColor);
  font: var(--dsw-font-xxxs-strong-11, 500 11px/14px system-ui);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
  white-space: nowrap;
}

.aicd-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-btn:disabled { opacity: 0.5; cursor: default; }

.aicd-btn[data-variant="primary"] {
  border-color: transparent;
  background: var(--dsw-alias-state-business-primary, #4176e6);
  color: var(--dsw-alias-label-primary-foreground, #fff);
}

.aicd-btn[data-variant="primary"]:hover {
  background: var(--dsw-alias-state-business-primary, #4176e6);
  filter: brightness(1.06);
}

.aicd-btn-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
}

/* ---------- upload timeline ---------- */

.aicd-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.aicd-group-label {
  padding: 8px 10px 2px;
  font: var(--dsw-font-xxxs-11-strong, 500 11px/1.4 var(--dsw-font-family-sans, sans-serif));
  color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));
  letter-spacing: 0.03em;
}

.aicd-thumb {
  width: 18px;
  height: 18px;
  border-radius: var(--dsw-radius-xs, 4px);
  object-fit: cover;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.2));
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.08));
}

/* ---------- detail / note ---------- */

.aicd-detail {
  flex: none;
  margin: 6px 8px 10px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.2));
  border-radius: var(--dsw-radius-md, 12px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aicd-detail-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.aicd-detail-name {
  font: var(--dsw-font-xxs-strong-12, 500 12px/18px system-ui);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  align-items: baseline;
}

.aicd-kv dt {
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-kv dd {
  margin: 0;
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-secondary, currentColor);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 108px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-primary, currentColor);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui);
  resize: vertical;
}

.aicd-textarea:focus {
  outline: none;
  border-color: var(--dsw-alias-state-business-primary, #4176e6);
}

.aicd-note {
  padding: 8px 4px 0;
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-note[data-tone="ok"] { color: var(--dsw-alias-state-success-primary, #2f9e44); }
.aicd-note[data-tone="bad"] { color: var(--dsw-alias-state-error-primary, #d64545); }

/* ---------- empty / loading / error ---------- */

.aicd-body[data-center="true"] {
  display: grid;
  place-items: center;
  padding-bottom: 48px;
}

.aicd-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 16px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary, currentColor);
}

.aicd-empty-icon {
  display: inline-flex;
  color: var(--dsw-alias-label-caption, currentColor);
  opacity: 0.7;
}

.aicd-empty-title {
  font: var(--dsw-font-xxs-strong-12, 500 12px/18px system-ui);
  color: var(--dsw-alias-label-secondary, currentColor);
}

.aicd-empty-hint {
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
  max-width: 30ch;
}

.aicd-skel {
  height: 10px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-skeleton, rgba(127, 127, 127, 0.12));
  animation: aicd-pulse 1.4s ease-in-out infinite;
}

.aicd-skel-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 6px;
}

@keyframes aicd-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

@media (prefers-reduced-motion: reduce) {
  .aicd-skel { animation: none; }
  .aicd-row, .aicd-btn, .aicd-iconbtn, .aicd-tab, .aicd-chip { transition: none; }
}

/* ---------- composer entry ---------- */

.aicd-entry {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #61666b);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.aicd-entry:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-entry[data-blocked="true"]::after {
  content: "";
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--dsw-alias-state-warn-primary, #d9a406);
}

/* Focus visible everywhere, using the host ring. */
.aicd-panel :focus-visible,
.aicd-entry:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4176e6);
  outline-offset: 1px;
  border-radius: var(--dsw-radius-sm, 8px);
}

/* ---------- fallback overlay (only when the host has no sidebar) ---------- */

.aicd-overlay {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  width: min(380px, calc(100vw - 32px));
  max-height: min(70vh, 620px);
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  border-radius: var(--dsw-radius-lg, 16px);
  background: var(--dsw-alias-bg-base, #fff);
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(0, 0, 0, 0.18));
}

.aicd-overlay-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px 0 12px;
}
`;

    //#endregion styles

    //#region helpers
    /** Icons and the small pure functions every view shares. */
    const ICONS = {
      folder: 'M1.6 4.1c0-.6.5-1.1 1.1-1.1h3l1.3 1.4h6.3c.6 0 1.1.5 1.1 1.1v6.4c0 .6-.5 1.1-1.1 1.1H2.7c-.6 0-1.1-.5-1.1-1.1V4.1Z',
      file: 'M4.4 2.2h4.9l2.9 2.9v8.7H4.4V2.2Zm4.9 0v2.9h2.9',
      code: 'M6.4 6.2 4.2 8l2.2 1.8M9.6 6.2 11.8 8l-2.2 1.8',
      warn: 'M8 2.4 14.2 13H1.8L8 2.4Zm0 3.4v3.4m0 2.2v.1',
      lock: 'M4.6 7V5.4a3.4 3.4 0 0 1 6.8 0V7M3.4 7h9.2v6.2H3.4V7Z',
      note: 'M3.2 2.2h9.6v11.6H3.2V2.2Zm2 3.2h5.6m-5.6 2.8h5.6m-5.6 2.8h3.2',
      search: 'M7.2 12.2a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm3.7-1.3 2.9 2.9',
      refresh: 'M13 8a5 5 0 1 1-1.6-3.7M13 2.6V5.2h-2.6',
      close: 'M4 4l8 8M12 4l-8 8',
      upload: 'M8 10.6V2.8m0 0L5.2 5.6M8 2.8l2.8 2.8M2.6 11.4v1.8h10.8v-1.8',
      bookmark: 'M4 2.2h8v11.6L8 10.6l-4 3.2V2.2Z',
      spark: 'M8 2.2 9.4 6.4 13.6 8 9.4 9.6 8 13.8 6.6 9.6 2.4 8 6.6 6.4 8 2.2Z'
    };

    function Icon({ name, size = 14, stroke = 1.3, className }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
          focusable: 'false',
          className,
          style: { display: 'block' }
        },
        h('path', {
          d: ICONS[name],
          stroke: 'currentColor',
          strokeWidth: stroke,
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        })
      );
    }

    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || bytes < 0) return '';
      if (bytes === 0) return '0 B';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatTokens(range) {
      if (range === undefined || range === null || typeof range.min !== 'number') return '—';
      const min = range.min.toLocaleString();
      const max = range.max.toLocaleString();
      return min === max ? `~${min}` : `~${min}–${max}`;
    }

    /** Same range, but short enough for a stat card: 243k–304k. */
    /** Images can be shown as thumbnails; everything else keeps its icon. */
    const IMAGE_TYPES = new Set(['png', 'jpeg', 'webp', 'gif']);

    /** Uploads are grouped the way people remember them: by day. */
    function dayLabel(timestamp, now = Date.now()) {
      const start = new Date(timestamp);
      const today = new Date(now);
      const dayOf = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (dayOf(start) === dayOf(today)) return tr('timelineToday');
      if (dayOf(start) === dayOf(new Date(now - 86400000))) return tr('timelineYesterday');
      return start.toISOString().slice(0, 10);
    }

    /** Uploads grouped by day, newest first — a timeline rather than a flat count. */
    function uploadGroups(uploads) {
      const groups = [];
      for (const item of uploads) {
        const label = dayLabel(item.receivedAt);
        const last = groups[groups.length - 1];
        if (last !== undefined && last.label === label) last.items.push(item);
        else groups.push({ label, items: [item] });
      }
      return groups;
    }

    /** The report as Markdown, so it can outlive this window. */
    function reportMarkdown(data) {
      const scanned = data.scanned || {};
      const lines = ['# AI context report', ''];
      if (typeof data.workspace === 'string') lines.push(`- Workspace: \`${data.workspace}\``);
      if (typeof scanned.healthScore === 'number') lines.push(`- Health: ${scanned.healthScore}/100`);
      if (typeof scanned.noisePercent === 'number') lines.push(`- Noise: ${scanned.noisePercent}%`);
      if (typeof scanned.scannedFiles === 'number') {
        lines.push(`- Scanned: ${scanned.scannedFiles} files, ${formatBytes(scanned.scannedBytes || 0)}`);
      }
      const saved = data.savedTokens;
      if (saved && typeof saved.bytes === 'number') {
        lines.push(`- Kept out: ${formatBytes(saved.bytes)} (about ${formatTokensCompact(saved)} tokens)`);
      }
      const section = (title, items, format) => {
        if (!items || items.length === 0) return;
        lines.push('', `## ${title}`, '');
        for (const item of items) lines.push(`- ${format(item)}`);
      };
      section('Refused reads', data.skipped, (item) => `\`${item.path}\` — ${item.reason} (${formatBytes(item.bytes)})`);
      section('Read into context', data.reads, (item) => `\`${item.path}\` — ${item.verdict} (${formatBytes(item.bytes)})`);
      section('Files touched this session', data.sessionFiles, (item) => `\`${item.path}\` — ${formatBytes(item.bytes)}`);
      section('Uploads', data.uploads, (item) => `${item.type} ${item.name} (${formatBytes(item.bytes)})`);
      if (typeof data.notes === 'string' && data.notes.trim().length > 0) {
        lines.push('', '## Note for the agent', '', data.notes.trim());
      }
      lines.push('');
      return lines.join('\n');
    }

    function downloadReport(data, onDone) {
      try {
        const blob = new Blob([reportMarkdown(data)], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ai-context-report-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        if (onDone) onDone(null);
      } catch (error) {
        if (onDone) onDone(error);
      }
    }

    function formatTokensCompact(range) {
      if (range === undefined || range === null || typeof range.min !== 'number') return '—';
      const short = (value) => (value >= 10000 ? `${Math.round(value / 1000)}k` : value.toLocaleString());
      const min = short(range.min);
      const max = short(range.max);
      return min === max ? `~${min}` : `~${min}–${max}`;
    }

    function formatTime(stamp) {
      try {
        return new Date(stamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '';
      }
    }

    /** Last three segments, so a deep workspace path still fits a tab header. */
    function shortPath(path) {
      if (typeof path !== 'string' || path === '') return '';
      const parts = path.split('/').filter((part) => part !== '');
      if (parts.length <= 3) return parts.join('/');
      return `…/${parts.slice(-3).join('/')}`;
    }

    function toneFor(score) {
      if (typeof score !== 'number') return undefined;
      if (score < 60) return 'bad';
      if (score < 85) return 'warn';
      return 'good';
    }

    //#endregion helpers

    //#region components
    let stylesInjected = false;
    function injectStyles(doc) {
      if (stylesInjected || doc === undefined || doc === null) return;
      if (typeof doc.getElementById !== 'function') return;
      if (doc.getElementById(`${NS}:styles`) !== null) {
        stylesInjected = true;
        return;
      }
      const style = doc.createElement('style');
      style.id = `${NS}:styles`;
      style.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(style);
      stylesInjected = true;
    }

    /** One interactive row; every list in the panel uses it. */
    function Row({ icon, lead, name, meta, dot, badge, selected, onClick, title }) {
      return h(
        'button',
        {
          type: 'button',
          className: 'aicd-row',
          'data-selected': selected === true ? 'true' : undefined,
          title: title || name,
          onClick
        },
        lead !== undefined && lead !== null
          ? h('span', { className: 'aicd-row-icon' }, lead)
          : icon === undefined ? null : h('span', { className: 'aicd-row-icon' }, h(Icon, { name: icon, size: 14 })),
        dot === undefined ? null : h('span', { className: 'aicd-dot', 'data-status': dot }),
        h('span', { className: 'aicd-row-name' }, h('code', null, name)),
        badge === undefined || badge === null || badge.length === 0
          ? null
          : h('span', { className: 'aicd-row-flags' },
              badge.map((item) => h('span', { key: item.text, className: 'aicd-badge', 'data-tone': item.tone }, item.text))
            ),
        meta === undefined || meta === null ? null : h('span', { className: 'aicd-row-meta' }, meta)
      );
    }

    function Empty({ icon = 'folder', title, hint, action }) {
      return h('div', { className: 'aicd-empty' },
        h('span', { className: 'aicd-empty-icon' }, h(Icon, { name: icon, size: 22, stroke: 1.1 })),
        title === undefined ? null : h('div', { className: 'aicd-empty-title' }, title),
        hint === undefined || hint === '' ? null : h('div', { className: 'aicd-empty-hint' }, hint),
        action === undefined ? null : action
      );
    }

    function Skeleton() {
      const widths = ['72%', '54%', '81%', '46%', '64%'];
      return h('div', { 'aria-busy': 'true' },
        widths.map((width, index) =>
          h('div', { key: index, className: 'aicd-skel-row' },
            h('div', { className: 'aicd-skel', style: { width: 12, height: 12 } }),
            h('div', { className: 'aicd-skel', style: { width } })
          )
        )
      );
    }

    function useReport() {
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [at, setAt] = useState('');
      const [tree, setTree] = useState(null);

      const loadReport = useCallback(() => {
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
        loadReport();
        const timer = setInterval(loadReport, 5000);
        return () => clearInterval(timer);
      }, [loadReport]);

      useEffect(() => {
        loadTree(at);
      }, [at, loadTree]);

      return { data, error, at, setAt, tree, reload: loadReport, reloadTree: () => loadTree(at) };
    }

    function Detail({ item, pending, onAllow, onIgnore }) {
      if (item === null || item === undefined) return null;
      const badge = item.ignored === true
        ? { text: tr('badgeIgnored'), tone: 'neutral' }
        : item.badge === 'noise'
          ? { text: `${tr('badgeNoise')} · ${item.reason}`, tone: 'noise' }
          : item.badge === 'review'
            ? { text: tr('badgeReview'), tone: 'review' }
            : item.type === 'file'
              ? { text: tr('badgeSource'), tone: 'neutral' }
              : null;

      return h('div', { className: 'aicd-detail' },
        h('div', { className: 'aicd-detail-head' },
          h('span', { className: 'aicd-row-icon' }, h(Icon, { name: item.type === 'dir' ? 'folder' : 'code', size: 14 })),
          h('span', { className: 'aicd-detail-name', title: item.path }, item.path),
          badge === null ? null : h('span', { className: 'aicd-badge', 'data-tone': badge.tone }, badge.text)
        ),
        h('dl', { className: 'aicd-kv' },
          h('dt', null, tr('detailSize')),
          h('dd', null, formatBytes(item.bytes)),
          item.type === 'file' ? h('dt', null, tr('detailCost')) : null,
          item.type === 'file' ? h('dd', null, formatTokens(item.tokens)) : null,
          item.read === true ? h('dt', null, tr('detailRead')) : null,
          item.read === true ? h('dd', null, item.verdict === 'allowed' ? tr('detailAllowed') : tr('badgeSource')) : null,
          item.blocked === true ? h('dt', null, tr('detailBlocked')) : null,
          item.blocked === true ? h('dd', null, `${item.tries} ${tr('detailAttempts')}`) : null
        ),
        item.type === 'file'
          ? h('div', { className: 'aicd-btn-row' },
              h('button', {
                type: 'button',
                className: 'aicd-btn',
                'data-variant': 'primary',
                disabled: pending === item.path,
                onClick: () => onAllow(item.path)
              }, tr('readOnce')),
              h('button', {
                type: 'button',
                className: 'aicd-btn',
                disabled: pending === item.path,
                onClick: () => onIgnore(item.path)
              }, tr('neverRead'))
            )
          : null
      );
    }

    //#endregion components

    //#region views
    function FilesView({ data, tree, at, setAt, pending, onAllow, onIgnore, lastIgnored, onUndo }) {
      const [query, setQuery] = useState('');
      const [filter, setFilter] = useState('all');
      const [selected, setSelected] = useState(null);
      const [picked, setPicked] = useState([]);
      const [anchor, setAnchor] = useState(null);
      const [sort, setSort] = useState('size');

      const matches = (entry) => {
        if (query !== '' && !entry.path.toLowerCase().includes(query.toLowerCase())) return false;
        if (filter === 'noise') return entry.badge === 'noise';
        if (filter === 'review') return entry.badge === 'review';
        if (filter === 'ignored') return entry.ignored === true;
        return true;
      };

      const clearSelection = () => {
        setSelected(null);
        setPicked([]);
        setAnchor(null);
      };

      /** Click, Cmd/Ctrl-click and Shift-click, the way a file list behaves. */
      const pick = (path, event) => {
        const additive = event !== undefined && event !== null && (event.metaKey === true || event.ctrlKey === true);
        const range = event !== undefined && event !== null && event.shiftKey === true;
        if (range && anchor !== null) {
          const paths = visiblePaths();
          const from = paths.indexOf(anchor);
          const to = paths.indexOf(path);
          if (from !== -1 && to !== -1) {
            const [start, end] = from <= to ? [from, to] : [to, from];
            setPicked(paths.slice(start, end + 1));
            return;
          }
        }
        if (additive) {
          setPicked(picked.includes(path) ? picked.filter((item) => item !== path) : [...picked, path]);
          setAnchor(path);
          return;
        }
        setPicked([path]);
        setAnchor(path);
      };

      const visiblePaths = () => sortedEntries().filter((entry) => entry.type !== 'dir').map((entry) => entry.path);

      const sortedEntries = () => {
        const list = (tree === null ? [] : tree.entries || []).filter(matches).slice();
        return list.sort((left, right) => {
          if ((left.type === 'dir') !== (right.type === 'dir')) return left.type === 'dir' ? -1 : 1;
          if (sort === 'name') return String(left.name).localeCompare(String(right.name));
          return (right.bytes || 0) - (left.bytes || 0);
        });
      };
      const sessionFiles = (data.sessionFiles || []).filter(matches).slice(0, 8);
      const entries = sortedEntries();
      const total = tree === null ? 0 : (tree.total === undefined ? (tree.entries || []).length : tree.total);

      const filters = [
        ['all', tr('filterAll')],
        ['noise', tr('filterNoise')],
        ['review', tr('filterReview')],
        ['ignored', tr('filterIgnored')]
      ];

      const rowBadges = (entry) => {
        if (entry.ignored === true) return [{ text: tr('badgeIgnored'), tone: 'neutral' }];
        if (entry.badge === 'noise') return [{ text: tr('badgeNoise'), tone: 'noise' }];
        if (entry.badge === 'review') return [{ text: tr('badgeReview'), tone: 'review' }];
        return [];
      };

      const crumbs = [
        h('button', {
          key: 'root',
          type: 'button',
          className: 'aicd-chip',
          'data-active': at === '' ? 'true' : 'false',
          onClick: () => { setAt(''); clearSelection(); }
        }, tr('workspaceTitle'))
      ];
      if (at !== '') {
        const parent = tree !== null && tree.parent !== null && tree.parent !== undefined ? tree.parent : '';
        crumbs.push(h('span', { key: 'sep', className: 'aicd-row-meta' }, '/'));
        crumbs.push(h('button', {
          key: 'up',
          type: 'button',
          className: 'aicd-chip',
          onClick: () => { setAt(parent); clearSelection(); }
        }, `↑ ${tr('up')}`));
        crumbs.push(h('span', { key: 'path', className: 'aicd-section-note', title: at }, at));
      }

      return h('div', { className: 'aicd-files' },
        h('div', { className: 'aicd-toolbar' },
          h('label', { className: 'aicd-search' },
            h(Icon, { name: 'search', size: 13 }),
            h('input', {
              type: 'search',
              value: query,
              placeholder: tr('search'),
              'aria-label': tr('search'),
              onChange: (event) => setQuery(event.target.value)
            })
          ),
          h('div', { className: 'aicd-chips' },
            filters.map(([id, label]) =>
              h('button', {
                key: id,
                type: 'button',
                className: 'aicd-chip',
                'data-active': filter === id ? 'true' : 'false',
                onClick: () => setFilter(id)
              }, label)
            ),
            h('span', { className: 'aicd-count' }, tr('filesCount').replace('{n}', String(total)))
          )
        ),
        h('div', { className: 'aicd-chips', style: { padding: '0 4px 6px' } },
          h('button', {
            key: 'size',
            type: 'button',
            className: 'aicd-chip',
            'data-active': sort === 'size' ? 'true' : 'false',
            onClick: () => setSort('size')
          }, tr('sortSize')),
          h('button', {
            key: 'name',
            type: 'button',
            className: 'aicd-chip',
            'data-active': sort === 'name' ? 'true' : 'false',
            onClick: () => setSort('name')
          }, tr('sortName')),
          picked.length > 1
            ? h('button', {
                key: 'batch',
                type: 'button',
                className: 'aicd-chip',
                'data-active': 'true',
                onClick: () => {
                  const targets = picked.slice();
                  const step = (index) => {
                    if (index >= targets.length) {
                      setPicked([]);
                      return;
                    }
                    onIgnore(targets[index], () => step(index + 1));
                  };
                  step(0);
                }
              }, tr('batchIgnore').replace('{n}', String(picked.length)))
            : null,
          picked.length > 1
            ? h('button', {
                key: 'clear',
                type: 'button',
                className: 'aicd-chip',
                onClick: () => setPicked([])
              }, tr('batchClear'))
            : null
        ),
        lastIgnored === null || lastIgnored === undefined
          ? null
          : h('div', { className: 'aicd-note', 'data-tone': 'ok' },
              h('span', null, `${tr('undoHint')} `),
              h('button', {
                type: 'button',
                className: 'aicd-chip',
                onClick: () => onUndo(lastIgnored)
              }, tr('undoAction'))
            ),
        h('div', { className: 'aicd-body' },
          sessionFiles.length === 0 && (query !== '' || filter !== 'all')
            ? null
            : h('div', null,
                h('div', { className: 'aicd-section' },
                  h('span', { className: 'aicd-section-title' }, tr('sessionTitle')),
                  h('span', { className: 'aicd-count' }, String(sessionFiles.length))
                ),
                sessionFiles.length === 0
                  ? h('div', { className: 'aicd-note' }, tr('sessionNone'))
                  : sessionFiles.map((item) =>
                      h(Row, {
                        key: item.path,
                        icon: item.kind === 'written' ? 'note' : 'file',
                        name: item.path,
                        badge: [{ text: item.kind === 'written' ? tr('kindWritten') : tr('kindRead'), tone: 'neutral' }],
                        meta: formatBytes(item.bytes),
                        selected: selected !== null && selected.path === item.path,
                        onClick: () => setSelected({ ...item, type: 'file' })
                      })
                    )
              ),
          h('div', { className: 'aicd-section' },
            h('span', { className: 'aicd-section-title' }, tr('workspaceTitle')),
            h('span', { className: 'aicd-count' }, at === '' ? (data.workspace || '') : at)
          ),
          h('div', { className: 'aicd-chips', style: { padding: '0 4px 4px' } }, crumbs),
          tree === null
            ? h(Skeleton, null)
            : entries.length === 0
              ? h(Empty, {
                  icon: 'folder',
                  title: query !== '' || filter !== 'all' ? tr('noMatch') : tr('emptyDir'),
                  hint: at === '' ? data.workspace : undefined
                })
              : h('div', null,
                  entries.map((entry) =>
                    h(Row, {
                      key: entry.path,
                      icon: entry.type === 'dir' ? 'folder' : (entry.ignored === true ? 'lock' : entry.badge === 'noise' ? 'warn' : entry.badge === 'review' ? 'bookmark' : 'file'),
                      name: entry.name,
                      badge: entry.type === 'dir' ? undefined : rowBadges(entry),
                      meta: entry.type === 'dir' ? '›' : formatBytes(entry.bytes),
                      selected: picked.includes(entry.path) || (selected !== null && selected.path === entry.path),
                      onClick: (event) => {
                        if (entry.type === 'dir') {
                          setAt(entry.path);
                          clearSelection();
                        } else {
                          setSelected(entry);
                          pick(entry.path, event);
                        }
                      }
                    })
                  ),
                  tree.truncated === true ? h('div', { className: 'aicd-note' }, tr('truncated')) : null
                )
        ),
        h(Detail, {
          item: selected,
          pending,
          onAllow: (target) => onAllow(target, clearSelection),
          onIgnore: (target) => onIgnore(target, clearSelection)
        })
      );
    }

    function InsightsView({ data }) {
      const scanned = data.scanned || {};
      const score = typeof scanned.healthScore === 'number' ? scanned.healthScore : null;
      const noise = typeof scanned.noisePercent === 'number' ? scanned.noisePercent : null;

      const card = (label, value) =>
        h('div', { className: 'aicd-card' },
          h('span', { className: 'aicd-card-value' }, value),
          h('span', { className: 'aicd-card-label' }, label)
        );

      const skipped = data.skipped || [];
      const reads = data.reads || [];
      const uploads = data.uploads || [];

      return h('div', { className: 'aicd-body' },
        h('div', { className: 'aicd-cards' },
          card(tr('score'), score === null ? '—' : String(score)),
          card(tr('noise'), noise === null ? '—' : `${noise}%`),
          card(tr('savedLabel'), formatTokensCompact(data.savedTokens))
        ),
        h('div', { className: 'aicd-section' },
          h('span', { className: 'aicd-section-title' }, tr('blockedTitle')),
          h('span', { className: 'aicd-count' }, String(skipped.length))
        ),
        skipped.length === 0
          ? h('div', { className: 'aicd-note' }, tr('blockedNone'))
          : skipped.map((item) =>
              h(Row, {
                key: item.path,
                icon: 'lock',
                name: item.path,
                badge: [{ text: item.reason, tone: 'noise' }],
                meta: `${formatBytes(item.bytes)} · ${item.attempts}×`
              })
            ),
        h('div', { className: 'aicd-section' },
          h('span', { className: 'aicd-section-title' }, tr('readsTitle')),
          h('span', { className: 'aicd-count' }, String(reads.length))
        ),
        reads.length === 0
          ? h('div', { className: 'aicd-note' }, tr('readsNone'))
          : reads.map((item) =>
              h(Row, {
                key: item.path,
                icon: 'file',
                name: item.path,
                badge: [{
                  text: item.verdict === 'review' ? tr('badgeReview') : item.verdict === 'allowed' ? tr('verdictAllowed') : tr('badgeSource'),
                  tone: 'neutral'
                }],
                meta: formatBytes(item.bytes)
              })
            ),
        h('div', { className: 'aicd-section' },
          h('span', { className: 'aicd-section-title' }, tr('uploadsTitle')),
          h('span', { className: 'aicd-count' }, String(uploads.length))
        ),
        uploads.length === 0
          ? h('div', { className: 'aicd-note' }, tr('uploadsNone'))
          : uploadGroups(uploads).map((group) =>
              h('div', { key: group.label, className: 'aicd-group' },
                h('div', { className: 'aicd-group-label' }, group.label),
                group.items.map((item) =>
                  h(Row, {
                    key: `${item.digest || item.name}-${item.receivedAt}`,
                    lead: IMAGE_TYPES.has(item.type)
                      ? h('img', {
                          className: 'aicd-thumb',
                          src: `/aiignore/upload?digest=${encodeURIComponent(item.digest || '')}`,
                          alt: '',
                          loading: 'lazy',
                          onError: (event) => { event.target.style.display = 'none'; }
                        })
                      : undefined,
                    icon: 'upload',
                    name: `${item.type} · ${item.name}`,
                    meta: `${formatBytes(item.bytes)} · ${formatTime(item.receivedAt)}`
                  })
                )
              )
            ),
        h('div', { className: 'aicd-note' }, tr('uploadsNote')),
        h('div', { className: 'aicd-note' }, tr('policyDeny')),
        h('div', { className: 'aicd-note' }, tr('tokensHint')),
        h('div', { className: 'aicd-btn-row' },
          h('button', {
            type: 'button',
            className: 'aicd-btn',
            onClick: () => downloadReport(data, (error) => { if (error) console.warn('report export failed', error); })
          }, tr('exportReport'))
        )
      );
    }

    function NoteView({ data, onSaved }) {
      const [notes, setNotes] = useState(null);
      const [status, setStatus] = useState(null);
      const value = notes === null ? (typeof data.notes === 'string' ? data.notes : '') : notes;
      const length = value.length;

      const save = () => {
        if (length > 4000) {
          setStatus('too-long');
          return;
        }
        fetch('/aiignore/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: value })
        })
          .then((response) => response.json())
          .then((payload) => {
            setStatus(payload.written === true ? 'saved' : payload.removed === true ? 'empty' : 'failed');
            if (onSaved !== undefined) onSaved();
          })
          .catch(() => setStatus('failed'));
      };

      return h('div', { className: 'aicd-body' },
        h('div', { className: 'aicd-section', style: { paddingTop: '8px' } },
          h('span', { className: 'aicd-section-title' }, tr('noteTitle'))
        ),
        h('div', { className: 'aicd-chips', role: 'group', 'aria-label': tr('templatesTitle') },
          TEMPLATES.map((template) =>
            h('button', {
              key: template.id,
              type: 'button',
              className: 'aicd-chip',
              onClick: () => {
                const snippet = tr(template.key);
                const next = value.trim().length === 0 ? snippet : `${value.replace(/\s+$/, '')}\n\n${snippet}`;
                setNotes(next.slice(0, 4000));
                setStatus(null);
              }
            }, tr(template.labelKey))
          )
        ),
        h('textarea', {
          className: 'aicd-textarea',
          rows: 6,
          value,
          placeholder: tr('notePlaceholder'),
          'aria-label': tr('noteTitle'),
          onChange: (event) => {
            setNotes(event.target.value);
            setStatus(null);
          }
        }),
        h('div', { className: 'aicd-btn-row', style: { padding: '8px 0 0' } },
          h('button', { type: 'button', className: 'aicd-btn', 'data-variant': 'primary', onClick: save }, tr('noteSave')),
          h('span', { className: 'aicd-count', style: { marginLeft: 'auto' } }, `${length} / 4000`)
        ),
        h('div', { className: 'aicd-note' }, tr('noteHint')),
        status === 'saved' ? h('div', { className: 'aicd-note', 'data-tone': 'ok' }, tr('noteSaved')) : null,
        status === 'too-long' ? h('div', { className: 'aicd-note', 'data-tone': 'bad' }, tr('noteTooLong')) : null,
        status === 'failed' ? h('div', { className: 'aicd-note', 'data-tone': 'bad' }, tr('noteFailed')) : null,
        status === 'empty' ? h('div', { className: 'aicd-note' }, tr('noteEmpty')) : null
      );
    }

    /** The panel: one header, three views, one report. */
    //#endregion views

    //#region shell
    function Panel() {
      const { data, error, at, setAt, tree, reload, reloadTree } = useReport();
      const [view, setView] = useState('files');
      const [pending, setPending] = useState(null);
      const [postError, setPostError] = useState(null);
      const [lastIgnored, setLastIgnored] = useState(null);

      const post = (route, target, done) => {
        setPending(target);
        setPostError(null);
        fetch(route, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: target })
        })
          .then((response) => response.json())
          .then((payload) => {
            if (done(payload)) reloadTree();
            else setPostError('refused');
          })
          .catch(() => setPostError('failed'))
          .finally(() => setPending(null));
      };

      const [scanError, setScanError] = useState(false);
      const scan = () => {
        setPending('scan');
        setScanError(false);
        fetch('/aiignore/scan', { method: 'POST', headers: { 'content-type': 'application/json' } })
          .then((response) => response.json())
          .then((payload) => {
            if (payload === null || typeof payload !== 'object' || payload.workspace === undefined || payload.workspace === null) {
              setScanError(true);
              return;
            }
            reload();
            reloadTree();
          })
          .catch(() => setScanError(true))
          .finally(() => setPending(null));
      };

      const onAllow = (target, after) => post('/aiignore/allow', target, (payload) => {
        const ok = payload.allowed === true;
        if (ok && after !== undefined) after();
        return ok;
      });
      const onIgnore = (target, after) => post('/aiignore/ignore', target, (payload) => {
        const ok = payload.ignored === true;
        if (ok) {
          // Keep the rule we just wrote, so the panel can take it back out.
          setLastIgnored(payload.rule || target);
          if (after !== undefined) after();
        }
        return ok;
      });
      const onUndo = (target, after) => post('/aiignore/unignore', target, (payload) => {
        const ok = payload.removed === true;
        if (ok) {
          setLastIgnored(null);
          if (after !== undefined) after();
        }
        return ok;
      });

      const scanned = data === null ? {} : (data.scanned || {});
      const score = typeof scanned.healthScore === 'number' ? scanned.healthScore : null;

      const tabs = [
        ['files', tr('tabFiles')],
        ['insights', tr('tabInsights')],
        ['note', tr('tabNote')]
      ];

      return h('div', { className: 'aicd-panel' },
        h('div', { className: 'aicd-head' },
          h('div', { className: 'aicd-head-main' },
            h('div', { className: 'aicd-head-text' },
              h('span', { className: 'aicd-path', title: data === null ? '' : (data.workspace || '') },
                data === null ? tr('loading') : (data.workspace === null || data.workspace === undefined
                  ? tr('webTitle')
                  : shortPath(data.workspace))
              )
            ),
            h('button', {
              type: 'button',
              className: 'aicd-iconbtn',
              title: tr('refresh'),
              'aria-label': tr('refresh'),
              onClick: () => { reload(); reloadTree(); }
            }, h(Icon, { name: 'refresh', size: 14 }))
          ),
          data !== null && score !== null && data.workspace !== null && data.workspace !== undefined
            ? h('div', { className: 'aicd-summary' },
                h('span', { className: 'aicd-score', 'data-tone': toneFor(score) }, String(score)),
                h('span', { className: 'aicd-caption' }, `${tr('score')} · ${tr('scoreHint')}`),
                h('span', { className: 'aicd-summary-spacer' }),
                h('span', { className: 'aicd-caption' },
                  `${tr('noise')} ${typeof scanned.noisePercent === 'number' ? `${scanned.noisePercent}%` : '—'}`)
              )
            : null,
          data === null
            ? null
            : h('div', { className: 'aicd-tabs', role: 'tablist' },
            tabs.map(([id, label]) =>
              h('button', {
                key: id,
                type: 'button',
                role: 'tab',
                className: 'aicd-tab',
                'aria-selected': view === id ? 'true' : 'false',
                onClick: () => setView(id)
              }, label)
            )
          )
        ),
        error !== null
          ? h('div', { className: 'aicd-body', 'data-center': 'true' },
              h(Empty, {
                icon: 'warn',
                title: tr('errorTitle'),
                hint: tr('errorHint'),
                action: h('div', null,
                  h('button', { type: 'button', className: 'aicd-btn', onClick: reload }, tr('retry')),
                  h('div', { className: 'aicd-note' },
                    `${tr('errorStatus')} ${String(error && error.message ? error.message : error)}`)
                )
              })
            )
          : data === null
            ? h('div', { className: 'aicd-body' }, h(Skeleton, null))
            : data.workspace === null || data.workspace === undefined
              ? h('div', { className: 'aicd-body', 'data-center': 'true' },
                  h(Empty, {
                    icon: 'spark',
                    title: tr('emptyTitle'),
                    hint: tr('emptyHint'),
                    action: h('div', null,
                      h('button', {
                        type: 'button',
                        className: 'aicd-btn',
                        'data-variant': 'primary',
                        disabled: pending === 'scan' ? 'true' : undefined,
                        onClick: scan
                      }, tr('scanNow')),
                      scanError ? h('div', { className: 'aicd-note', 'data-tone': 'bad' }, tr('scanFailed')) : null
                    )
                  })
                )
              : view === 'files'
                ? h(FilesView, {
                    data, tree, at, setAt, pending, onAllow, onIgnore,
                    lastIgnored, onUndo
                  })
                : view === 'insights'
                  ? h(InsightsView, { data })
                  : h(NoteView, { data, onSaved: reload }),
        postError !== null ? h('div', { className: 'aicd-note', 'data-tone': 'bad' }, tr('noteFailed')) : null
      );
    }

    /** The entry beside the composer's add-files control. */
    function Entry({ onOpen }) {
      const [blocked, setBlocked] = useState(0);

      useEffect(() => {
        let live = true;
        const read = () => {
          fetch('/aiignore/report', { headers: { accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
              if (!live || payload === null) return;
              setBlocked(Array.isArray(payload.skipped) ? payload.skipped.length : 0);
            })
            .catch(() => {});
        };
        read();
        const timer = setInterval(read, 10000);
        return () => {
          live = false;
          clearInterval(timer);
        };
      }, []);

      const label = blocked > 0 ? `${tr('entry')} · ${blocked} ${tr('blockedBadge')}` : tr('entry');
      return h('button', {
        type: 'button',
        className: 'aicd-entry',
        'data-blocked': blocked > 0 ? 'true' : 'false',
        title: label,
        'aria-label': label,
        onClick: onOpen
      }, h(Icon, { name: 'folder', size: 15 }));
    }

    /** Fallback surface: the same panel, floating, for hosts without a sidebar. */
    function Overlay({ onClose }) {
      return h('div', { className: 'aicd-overlay', role: 'dialog', 'aria-label': tr('tabTitle') },
        h('div', { className: 'aicd-overlay-head' },
          h('span', { style: { flex: 1 } }),
          h('button', {
            type: 'button',
            className: 'aicd-iconbtn',
            title: tr('close'),
            'aria-label': tr('close'),
            onClick: onClose
          }, h(Icon, { name: 'close', size: 13 }))
        ),
        h('div', { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }, h(Panel, null))
      );
    }

    /** The guide's capsule glyph: the same folder the composer entry uses. */
    function GuideIcon() {
      return h(Icon, { name: 'folder', size: 16 });
    }

    function EntrySlot({ hostCtx }) {
      const [floating, setFloating] = useState(false);
      const open = useCallback(() => {
        try {
          if (hostCtx.sidebarRight && typeof hostCtx.sidebarRight.openTab === 'function') {
            hostCtx.sidebarRight.openTab(KIND);
            return;
          }
        } catch {
          // fall through to the floating surface
        }
        setFloating(true);
      }, [hostCtx]);

      return h(React.Fragment, null,
        h(Entry, { onOpen: open }),
        floating ? h(Overlay, { onClose: () => setFloating(false) }) : null
      );
    }

    return {
      inject: ['slots', 'locale'],
    //#endregion shell

    //#region registration
      apply(ctx) {
        injectStyles(typeof document === 'undefined' ? undefined : document);

        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            ctx.locale.register(NS, COPY);
            translate = ctx.locale.bind(NS);
          }
        } catch {
          // No locale service: the panel keeps its English strings.
        }

        // The sidebar tab is the surface. It is registered through `ctx.inject`
        // so a host without the sidebar leaves the floating fallback intact.
        try {
          ctx.inject(['sidebarRightTabs', 'sidebarRight'], (tabCtx) => {
            if (tabCtx.slots === undefined || tabCtx.slots === null) return;
            tabCtx.effect(() => tabCtx.sidebarRightTabs.register({
              id: NS,
              kind: KIND,
                      title: () => tr('tabTitle'),
              guide: [{
                id: 'report',
                order: 40,
                title: () => tr('guideTitle'),
                description: () => tr('guideDesc'),
                icon: GuideIcon
              }]
            }), 'dsh-aiignore: tab type');

            tabCtx.effect(() => tabCtx.slots.inject('sidebar.right.pane.tab', () =>
              tabCtx.slots.register({ name: 'sidebar.right.pane.tab', key: NS, locale: NS }, Panel)
            ), 'dsh-aiignore: tab body');

            tabCtx.effect(() => tabCtx.slots.inject('sidebar.right.pane.tab.title', () =>
              tabCtx.slots.register({ name: 'sidebar.right.pane.tab.title', key: NS }, () =>
                h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
                  h(Icon, { name: 'folder', size: 14 }),
                  h('span', null, tr('tabTitle'))
                )
              )
            ), 'dsh-aiignore: tab title');
          });
        } catch {
          // Registration failures never take the composer entry down with them.
        }

        // The entry: one click, and the sidebar opens on the report. Guarded so a
        // host without a slot system still loads the plugin.
        if (ctx.slots !== undefined && ctx.slots !== null && typeof ctx.slots.inject === 'function') {
          ctx.slots.inject('conversation.input.left', () =>
            ctx.slots.register({ name: 'conversation.input.left', id: `${NS}:entry`, order: 20 }, () =>
              h(EntrySlot, { hostCtx: ctx })
            )
          );
        }
      }
    };

    //#endregion registration
  }
});
