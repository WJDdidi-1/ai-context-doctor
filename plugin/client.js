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
    const { useState, useEffect, useCallback, useRef } = React;

    const NS = 'dsh-aiignore';
    const KIND = 'ai-context';
    const SUMMARY_ID = 'dsh-aiignore-summary';

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
        entry: 'AIignore',
        tabTitle: 'AIignore',
        guideTitle: 'AIignore',
        guideDesc: 'What this session read, what was blocked, and the note you leave for the agent.',
        noise: 'noise',
        blockedBadge: 'held back',
        refresh: 'Refresh',
        tabFiles: 'Files',
        tabProtect: 'Protection',
        tabSettings: 'Settings',
        scoreCurrentLabel: 'Current score',
        scoreBeforeHint: 'Nothing applied yet. Optimize writes the rules this folder needs, then scores it again.',
        scorePendingUnderRules: '{reads} noisy reads here are not covered by your rules yet.',
        scoreUnknownLabel: 'Not scanned yet',
        scoreUnknownHint: 'Nothing here has been read yet. Optimize scans the folder, writes the rules it needs, and scores it.',
        strengthFold: 'Fine-tune the strength',
        heroOne: 'read held back by your rules',
        heroMany: 'reads held back by your rules',
        heroKept: 'never reached the model',
        heroQuietLine: 'This conversation read {files} files, {tokens} tokens — code and docs, no build output.',
        heroQuietLineShort: 'This conversation read {files} files — code and docs, no build output.',
        turns: 'turns',
        nextStep: 'One notch stricter blocks',
        nextFiles: 'more files',
        applyNext: 'Do that',
        nextDone: 'Turned up',
        rulesOn: 'rules in effect',
        openSettings: 'Change',
        tokens: 'tokens',
        chatTurns: 'turns',
        more: 'more',
        scoreFolder: 'Reaches the model',
        rescan: 'Scan again',
        noteWhy: 'Read before the agent starts. Context, not a command.',
        chatCurrent: 'current',
        working: 'Working…',
        scoreTitle: 'Why this score',
        scoreHow: 'How the score is computed',
        scoreFormula: 'Start at 100. Each category can cost at most its weight, and what it costs is how much of the folder it occupies: build output 40, large files 25, lockfiles 20, logs 15. Your rules and your strength remove categories from the count, which is why the right-hand number is higher.',
        noteInjected: 'What the agent will read',
        optimizeTitle: 'Make it better',
        optimizeHint: 'Writes these rules into .aiignore so the same files stop reaching the model. Your own lines stay untouched, and Undo puts the file back exactly as it was.',
        optimize: 'Optimize this workspace',
        optimizeNow: 'Optimize now',
        rules: 'rules',
        scoreOnDisk: 'On disk',
        of: 'of',
        phaseScan: 'Reading the folder…',
        // The Host writes the rules and re-scores in one request, so the second
        // step covers both rather than pretending to be two.
        phaseWrite: 'Writing rules and re-scoring…',
        optimizeNothing: 'Nothing to add — your rules already cover it.',
        optimizeConversation: 'Optimize from this conversation',
        optimizeConversationHint: 'Writes the rules this conversation needs: the noise it read stays out next time. Your own lines are kept, and one click puts the file back.',
        optimizeNone: 'Nothing to add here — this folder is already lean.',
        optimizeFailed: 'Could not finish that:',
        optimized: 'Added rules:',
        undoOptimize: 'Undo',
        strategyTitle: 'How strict should I be?',
        strengthTitle: 'How strict should I be?',
        strengthHintShort: 'The number on each notch is this folder\'s score there; picking one applies it.',
        strengthMovedGo: 'Go to Protection',
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
        emptyHint: 'Give it a folder and it will show you what the agent could be reading.',
        scanNow: 'Scan this conversation',
        scanFailed: 'That scan did not run — this conversation may not have a folder yet.',
        pickHint: 'The panel could not tell which folder this conversation runs in. Choose one:',
        pickSessions: 'sessions',
        follow: 'Follow this conversation',
        followOn: 'following this conversation',
        chooseFolder: 'Choose another folder…',
        clearChoice: 'Stop pinning this folder',
        panelLabel: 'AIignore',
        overviewTitle: 'AIignore',
        overviewHint: 'Every conversation this app has run, ranked by how much of what it read was noise. Fix the worst one first — you can undo any of it.',
        overviewNone: 'No conversations yet.',
        overviewNoneHint: 'Start one, and it will show up here with what it read.',
        overviewFailedTitle: 'Could not read the list',
        overviewFailed: 'The conversation list could not be read. Nothing is broken in your setup — the page just could not ask.',
        strengthFailedTitle: 'Could not read the table',
        strengthFailed: 'The strength table could not be read, so it is hidden for now. Your saved setting is unchanged — the panel is only missing the preview numbers.',
        chatUnavailable: 'This conversation could not be read',
        overviewOpen: 'Open the panel',
        overviewApply: 'Clean up',
        overviewConversations: 'conversations',
        files: 'files',
        scanned: 'Scanned',
        scanning: 'Scanning this folder…',
        scoreMoved: 'Score moved',
        coveredTitle: 'No longer reaching the model',
        coveredBadge: 'kept out',
        beforeRules: 'before your rules',
        optimizeUpToDate: 'Nothing left to add — your rules already cover what this scan found.',
        rulesTitle: 'Rules in .aiignore',
        rulesHint: 'One line, one kind of noise.',
        rulesNone: 'No rules yet. Optimize writes them for you, and you can always remove one here.',
        rulesRemove: 'Remove this rule',
        rulesRemoved: 'Removed.',
        chatPinned: 'showing an earlier conversation',
        chatFollowBack: 'Back to this conversation',
        rescanHint: 'Scan this folder again',
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
        legendNoise: 'rebuilt by a build, a lockfile or a log',
        legendReview: 'look before it goes in — env files, deploy scripts',
        legendIgnored: 'a line in .aiignore already stops it',
        suggestTitle: 'Worth a rule',
        suggestHint: 'Nothing is written until you click.',
        suggestAdd: 'Add',
        ruleAdded: 'Rule added:',
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
        blockedTitle: 'Held back from the model',
        blockedNone: 'Nothing has been blocked in this workspace yet.',
        blockedNone: 'Nothing held back yet.',
        sortSize: 'Largest first',
        sortName: 'Name',
        batchIgnore: 'Never read {n} files',
        batchClear: 'Clear',
        undoHint: 'Added to .aiignore.',
        undoAction: 'Undo',
        timelineToday: 'Today',
        timelineYesterday: 'Yesterday',
        templateEntryLabel: 'Start here',
        templateEntry: 'Start from src/index.js. Everything else can wait until I ask.',
        templateAvoidLabel: 'Do not open',
        templateAvoid: 'Do not open dist/, build output, lockfiles or logs. If you think you need one, ask me first.',
        templateTestsLabel: 'Check my work',
        templateTests: 'After any change, run `npm test`. It is the fastest way to know you did not break something.',
        noteTitle: 'What the agent should know',
        noteHint: 'Saved to .aiignore.notes.md in this workspace and sent to the agent right away. It is not an order the tool enforces — it is context the agent reads before it starts.',
        notePlaceholder: 'e.g. Prefer lib/ over legacy/. Never read dist/.',
        noteSave: 'Save and send',
        noteSaved: 'Saved. The agent has it.',
        noteTooLong: 'Too long — keep it under 4000 characters.',
        noteFailed: 'That did not go through. Try again.',
        noteEmpty: 'Empty notes are removed, not saved.',
        close: 'Close',
        diagTitle: 'Diagnostics',
        diagCopy: 'Copy',
        diagCopied: 'Copied',
        diagFailed: 'Could not read the diagnostics',
        diagLoading: 'Reading…',
        diagPlugin: 'Plugin',
        diagNode: 'Node',
        diagPlatform: 'Platform',
        diagHome: 'Data folder',
        diagWorkspace: 'Workspace',
        diagSessions: 'Conversations',
        diagRules: 'Rules in effect',
        diagSurface: 'Surface',
        diagSidebar: 'sidebar tab',
        diagOverlay: 'floating card',
        diagNone: 'not chosen yet'
      },
    //#endregion copy

      //#region copyZh
      zh: {
        entry: 'AIignore',
        tabTitle: 'AIignore',
        guideTitle: 'AIignore',
        guideDesc: '本次会话读了什么、挡了什么，以及你留给 AI 的说明。',
        noise: '噪音',
        blockedBadge: '项挡住',
        refresh: '刷新',
        tabFiles: '文件',
        tabProtect: '保护',
        tabSettings: '设置',
        scoreCurrentLabel: '当前评分',
        scoreBeforeHint: '还没有应用任何规则。点优化，写入这个文件夹需要的规则，然后重新评分。',
        scorePendingUnderRules: '这里有 {reads} 次噪音读取还没被规则覆盖。',
        scoreUnknownLabel: '还没有扫描',
        scoreUnknownHint: '这里还没有读过任何东西。点优化会扫描这个文件夹、写入它需要的规则，然后评分。',
        strengthFold: '微调力度',
        heroOne: '次读取被你的规则挡住',
        heroMany: '次读取被你的规则挡住',
        heroKept: '从没有进入模型',
        heroQuietLine: '这次对话读了 {files} 个文件、{tokens} tokens——都是代码和文档，没有构建产物。',
        heroQuietLineShort: '这次对话读了 {files} 个文件——都是代码和文档，没有构建产物。',
        turns: '轮',
        nextStep: '再严格一档会多挡下',
        nextFiles: '个文件',
        applyNext: '就这样做',
        nextDone: '已调高',
        rulesOn: '条规则在生效',
        openSettings: '修改',
        tokens: 'tokens',
        chatTurns: '轮',
        more: '条更多',
        scoreFolder: '还会进模型',
        rescan: '重新扫描',
        noteWhy: 'AI 每次开始干活前都会先读这段话。用它说明「这个仓库里什么重要」，用你自己的话就行。',
        chatCurrent: '当前',
        working: '处理中…',
        scoreTitle: '评分从哪来',
        scoreHow: '评分是怎么算的',
        scoreFormula: '从 100 分起扣。每类最多扣掉它的权重，实际扣多少取决于它占这个文件夹的比例：构建产物 40、大文件 25、锁文件 20、日志 15。你写的规则和筛选力度会把相应类别从扣分里去掉，所以右边那个数会更高。',
        noteInjected: 'AI 会读到的内容',
        optimizeTitle: '一键优化',
        optimizeHint: '把这些规则写进 .aiignore，同一批文件就不会再进模型了。你自己写的行不会动，撤销会把文件逐字节还原。',
        optimize: '优化这个工作区',
        optimizeNow: '立即优化',
        rules: '条规则',
        scoreOnDisk: '磁盘上',
        of: '共',
        phaseScan: '正在读取目录…',
        phaseWrite: '写入规则并重新评分…',
        optimizeNothing: '没有可加的规则——现有的规则已经覆盖了。',
        optimizeConversation: '按这个对话优化',
        optimizeConversationHint: '把这个对话读到的噪音写成规则，下次就不进了。你原有的行会保留，一次点击就能还原。',
        optimizeNone: '没有需要添加的规则：这个工作区已经很干净。',
        optimizeFailed: '没能完成这次操作：',
        optimized: '已添加规则：',
        undoOptimize: '撤销',
        strategyTitle: '筛选力度',
        strengthTitle: '要多严格？',
        strengthHintShort: '挑一档就生效：每格上的数字，是这个文件夹在这一档下的分数。',
        strengthMovedGo: '去保护页',
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
        pickHint: '面板没能确定这个对话属于哪个文件夹，请选择：',
        pickSessions: '个会话',
        follow: '跟随当前对话',
        followOn: '跟随当前对话',
        chooseFolder: '选择其它文件夹…',
        clearChoice: '取消固定文件夹',
        panelLabel: 'AIignore',
        overviewTitle: 'AIignore',
        overviewHint: '这里汇总这个应用跑过的每个对话，按「读进来的东西里有多少是噪音」排序。先处理最差的，每一步都能撤销。',
        overviewNone: '还没有对话。',
        overviewNoneHint: '开一个对话，它读过的文件就会显示在这里。',
        overviewFailedTitle: '没能读到列表',
        overviewFailed: '这次没能读到对话列表。不是你的设置有问题，只是这一次没拿到。',
        strengthFailedTitle: '没能读到力度表',
        strengthFailed: '这次没能读到力度表，所以先把它收起来。你已保存的设置没有改动，只是暂时看不到每一档的预览分数。',
        chatUnavailable: '这次没能读到当前对话',
        overviewOpen: '打开面板',
        overviewApply: '清理',
        overviewConversations: '个对话',
        files: '个文件',
        scanned: '已扫描',
        scanning: '正在扫描这个文件夹…',
        scoreMoved: '评分变化',
        coveredTitle: '不再进模型的内容',
        coveredBadge: '已挡下',
        beforeRules: '规则前',
        optimizeUpToDate: '没有可加的了——现有规则已经覆盖这次扫描发现的东西。',
        rulesTitle: '.aiignore 里的规则',
        rulesHint: '一行挡住一类噪音。',
        rulesNone: '还没有规则。点「优化」会自动写入，也可以在这里逐条删除。',
        rulesRemove: '删除这条规则',
        rulesRemoved: '已删除。',
        chatPinned: '正在查看较早的对话',
        chatFollowBack: '回到当前对话',
        rescanHint: '重新扫描这个文件夹',
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
        legendNoise: '构建产物、锁文件或日志——重新生成就有，读进来只占上下文',
        legendReview: '值得先看一眼：环境文件、部署脚本、大数据文件',
        legendIgnored: '.aiignore 里已经有一行挡住它，AI 根本看不到',
        suggestTitle: '值得加一条规则',
        suggestHint: '不点就不会写入任何东西。',
        suggestAdd: '加入',
        ruleAdded: '已加入规则：',
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
        blockedTitle: '挡在模型之外',
        blockedNone: '这个工作区还没有文件被挡下。',
        blockedNone: '暂时没有挡住任何东西。',
        sortSize: '按大小',
        sortName: '按名称',
        batchIgnore: '批量不再读取（{n}）',
        batchClear: '清除选择',
        undoHint: '已写入 .aiignore。',
        undoAction: '撤销',
        timelineToday: '今天',
        timelineYesterday: '昨天',
        templateEntryLabel: '从这里开始',
        templateEntry: '先看 src/index.js，其它等我问再说。',
        templateAvoidLabel: '别打开这些',
        templateAvoid: '不要打开 dist/、构建产物、锁文件和日志。真需要就先问我。',
        templateTestsLabel: '帮我验证',
        templateTests: '改完代码跑一遍 `npm test`，这是最快的验证方式。',
        noteTitle: '想让 AI 知道的事',
        noteHint: '保存到本工作区的 .aiignore.notes.md，并立即发送给 AI。',
        notePlaceholder: '例如：优先用 lib/，不要用 legacy/；永远不要读 dist/。',
        noteSave: '保存并发送',
        noteSaved: '已保存，AI 已收到。',
        noteTooLong: '太长了——请控制在 4000 字以内。',
        noteFailed: '没有成功，请再试一次。',
        noteEmpty: '空内容会被删除，而不是保存。',
        close: '关闭',
        diagTitle: '诊断信息',
        diagCopy: '复制',
        diagCopied: '已复制',
        diagFailed: '读不到诊断信息',
        diagLoading: '正在读取…',
        diagPlugin: '插件版本',
        diagNode: 'Node',
        diagPlatform: '平台',
        diagHome: '数据目录',
        diagWorkspace: '工作区',
        diagSessions: '对话数',
        diagRules: '生效规则',
        diagSurface: '显示位置',
        diagSidebar: '侧栏标签页',
        diagOverlay: '浮层卡片',
        diagNone: '还没有选择'
      }
    };

    // Single source of truth: this text must match ui/panel.css byte for byte.
    //#endregion copyZh

    //#region styles
    const CSS = String.raw`/*
 * The AIignore panel's only stylesheet.
 *
 * Everything here is measured against the Host's own side panels: a 38px
 * header with a half-pixel rule, 28px controls, 15px icons at 1.3 stroke,
 * 13px text with 11px labels, and colour taken from --dsw-alias-* so the panel
 * follows light and dark without shipping a palette of its own. Local
 * variables below exist so a value is decided once; none of them hold a colour.
 */

.aicd-panel {
  /* A four-step interval and a four-step type ramp. Anything that needs a
   * fifth value is usually a sign the block wants to be split, not styled. */
  --aicd-s1: 4px;
  --aicd-s2: 8px;
  --aicd-s3: 14px;
  --aicd-s4: 22px;
  --aicd-fs-eyebrow: 11px;
  --aicd-fs-meta: 12px;
  --aicd-fs-body: 13px;
  --aicd-fs-hero: 30px;
  --aicd-gap: 8px;
  --aicd-pad: 10px;
  --aicd-row-radius: var(--dsw-radius-md, 12px);
  --aicd-card-radius: var(--dsw-radius-lg, 16px);
  --aicd-hairline: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.2));
  --aicd-line: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  --aicd-surface: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
  --aicd-hover: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1));
  --aicd-active: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.16));
  --aicd-accent: var(--dsw-alias-state-business-primary, #4d6bfe);

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary, #1b1b1f);
  background: var(--dsw-alias-bg-base, #fff);
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: 1.5;
}

/* ---------------------------------------------------------------- header -- */

.aicd-head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  padding: 8px 6px 0 16px;
  border-bottom: 0.5px solid var(--aicd-hairline, rgba(127,127,127,0.2));
}

.aicd-head-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 24px;
}

.aicd-head-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-right: auto;
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font-weight: 600;
}

.aicd-brand-icon {
  flex: none;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
}

.aicd-head-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-head-tools {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}

.aicd-head-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding-bottom: 6px;
}

.aicd-path {
  overflow: hidden;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The follow/pinned badge: small, quiet, and never louder than the path. */
.aicd-chipdot {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--aicd-surface, rgba(127,127,127,0.05));
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.aicd-chipdot[data-pinned="true"] {
  color: var(--dsw-alias-state-business-primary, #4d6bfe);
  background: var(--dsw-alias-state-business-tertiary, rgba(77, 107, 254, 0.1));
}

.aicd-toast {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  padding: 5px 8px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--aicd-surface, rgba(127,127,127,0.05));
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 12px;
  line-height: 16px;
}

/* ------------------------------------------------------------------ tabs -- */

/* The three views share one scroll container: the tab that opened it names it,
   so a screen reader says which tab a reader is inside. */
.aicd-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  outline: none;
}

.aicd-tabs {
  display: flex;
  flex: none;
  align-items: stretch;
  gap: 18px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: none;
}

.aicd-tab {
  position: relative;
  height: 32px;
  padding: 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 13px;
  line-height: 30px;
  cursor: pointer;
}

.aicd-tab:hover {
  color: var(--dsw-alias-label-primary, #1b1b1f);
}

.aicd-tab[aria-selected="true"] {
  color: var(--dsw-alias-label-primary, #1b1b1f);
  border-bottom-color: var(--aicd-accent, #4d6bfe);
  font-weight: 500;
}

/* ------------------------------------------------------------------ body -- */

.aicd-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 12px 16px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.aicd-body[data-center="true"] {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.aicd-body::-webkit-scrollbar {
  width: 10px;
}

.aicd-body::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background-clip: content-box;
  background-color: var(--dsw-alias-scrollbar-bg-l1, rgba(127, 127, 127, 0.35));
}

.aicd-body:hover::-webkit-scrollbar-thumb {
  background-color: var(--dsw-alias-scrollbar-hover-l1, rgba(127, 127, 127, 0.5));
}

/* -------------------------------------------------------------- sections -- */

.aicd-section {
  display: flex;
  flex-direction: column;
  gap: var(--aicd-gap, 8px);
}

.aicd-section + .aicd-section {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 0.5px solid var(--aicd-hairline, rgba(127,127,127,0.2));
}

.aicd-section-title {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 16px;
  text-transform: uppercase;
}

.aicd-section-note {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 12px;
  line-height: 1.5;
}

.aicd-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-top: var(--aicd-s3, 14px);
  border-top: 0.5px solid var(--aicd-hairline, rgba(127,127,127,0.2));
}

.aicd-list-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 4px;
}

.aicd-list-head .aicd-sortbtn {
  flex: none;
  margin-left: 0;
}

.aicd-list-title {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.aicd-list-count {
  margin-left: auto;
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.aicd-list-path {
  overflow: hidden;
  margin-left: auto;
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-list-empty {
  margin: 0;
  padding: 10px 2px;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 12px;
  line-height: 1.5;
}

.aicd-foot {
  display: flex;
  align-items: center;
  gap: var(--aicd-s1, 4px);
  margin-top: var(--aicd-s2, 8px);
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
}

/* ------------------------------------------------------------------ rows -- */

.aicd-row {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  min-height: 28px;
  padding: 5px 10px;
  border: none;
  border-radius: var(--aicd-row-radius, 12px);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.aicd-row:hover {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
}

.aicd-row:active {
  background: var(--aicd-active, rgba(127,127,127,0.16));
}

.aicd-row[data-selected="true"] {
  background: var(--aicd-active, rgba(127,127,127,0.16));
}

.aicd-row-icon {
  flex: none;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
}

.aicd-row-name {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-row-meta {
  flex: none;
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.aicd-row-flags {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

.aicd-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--aicd-surface, rgba(127,127,127,0.05));
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.aicd-badge[data-tone="noise"] {
  background: var(--dsw-alias-state-warn-tertiary, rgba(217, 163, 65, 0.14));
  color: var(--dsw-alias-state-warn-primary, #b4791f);
}

.aicd-badge[data-tone="review"] {
  background: var(--dsw-alias-state-business-tertiary, rgba(77, 107, 254, 0.12));
  color: var(--dsw-alias-state-business-primary, #4d6bfe);
}

.aicd-badge[data-tone="danger"] {
  background: var(--dsw-alias-state-error-secondary, rgba(217, 90, 90, 0.14));
  color: var(--dsw-alias-state-error-primary, #c94a4a);
}

.aicd-dot {
  display: inline-block;
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-label-tertiary, #8b8b8b);
}

.aicd-dot[data-status="source"] {
  background: var(--dsw-alias-state-business-primary, #4d6bfe);
}

.aicd-dot[data-status="noise"] {
  background: var(--dsw-alias-state-warn-primary, #d9a341);
}

.aicd-dot[data-status="written"] {
  background: var(--dsw-alias-state-success-primary, #3f9c6a);
}

.aicd-dot[data-status="blocked"] {
  background: var(--dsw-alias-state-error-primary, #c94a4a);
}

.aicd-count {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

/* -------------------------------------------------------------- controls -- */

.aicd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  height: 28px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.aicd-btn:hover:not(:disabled) {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
}

.aicd-btn:active:not(:disabled) {
  background: var(--aicd-active, rgba(127,127,127,0.16));
}

.aicd-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.aicd-btn[data-variant="primary"] {
  border-color: transparent;
  /* A filled button needs a fill that carries white text in both themes. The
     host's business colour is light in dark mode on purpose — it is for text
     and icons there — so using it as a background left white on #7aaaff. */
  background: #2f4f96;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4d6bfe) 62%, #000);
  color: #fff;
  font-weight: 500;
}

.aicd-btn[data-variant="primary"]:hover:not(:disabled) {
  filter: brightness(1.12);
}

.aicd-btn[data-wide="true"] {
  width: 100%;
  height: 32px;
  font-size: 13px;
  font-weight: 600;
}

.aicd-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.aicd-textbtn {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--dsw-alias-state-business-primary, #4d6bfe);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.aicd-hint > .aicd-textbtn {
  flex: none;
  margin: 0 0 0 auto;
  white-space: nowrap;
}

.aicd-textbtn:hover {
  text-decoration: underline;
}

.aicd-minibtn {
  height: 22px;
  padding: 0 8px;
  border: 0.5px solid transparent;
  border-radius: 999px;
  background: var(--aicd-surface, rgba(127,127,127,0.05));
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font: inherit;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}

.aicd-minibtn:hover {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
  color: var(--dsw-alias-label-primary, #1b1b1f);
}

.aicd-iconbtn {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  cursor: pointer;
}

.aicd-iconbtn:hover:not(:disabled) {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
  color: var(--dsw-alias-label-primary, #1b1b1f);
}

.aicd-iconbtn:active:not(:disabled) {
  background: var(--aicd-active, rgba(127,127,127,0.16));
}

.aicd-iconbtn:disabled {
  color: var(--dsw-alias-label-quaternary, #b9b9b9);
  cursor: default;
}

.aicd-iconbtn[data-busy="true"] {
  color: var(--aicd-accent, #4d6bfe);
}

.aicd-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.aicd-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font: inherit;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}

.aicd-chip:hover:not(:disabled) {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
  color: var(--dsw-alias-label-primary, #1b1b1f);
}

.aicd-chip[data-active="true"] {
  background: var(--aicd-active, rgba(127,127,127,0.16));
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font-weight: 500;
}

.aicd-chip:disabled {
  opacity: 0.5;
  cursor: default;
}

.aicd-toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.aicd-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

.aicd-filters .aicd-count {
  margin-left: auto;
  padding-right: 2px;
}

.aicd-search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  min-width: 0;
  height: 28px;
  padding: 0 9px;
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--aicd-surface, rgba(127,127,127,0.05));
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
}

.aicd-search:focus-within {
  border-color: var(--aicd-accent, #4d6bfe);
  outline: 1px solid var(--aicd-accent, #4d6bfe);
  outline-offset: -1px;
}

.aicd-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font: inherit;
  font-size: 12px;
}

.aicd-search input::placeholder {
  color: var(--dsw-alias-label-caption, #9a9a9a);
}

.aicd-subbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.aicd-sortbtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 6px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.aicd-sortbtn:hover {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
  color: var(--dsw-alias-label-primary, #1b1b1f);
}

.aicd-crumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 11px;
}

.aicd-textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 84px;
  padding: 8px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.04));
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.55;
  resize: vertical;
}

.aicd-textarea::placeholder {
  color: var(--dsw-alias-label-quaternary, #b9b9b9);
}

.aicd-textarea:focus {
  border-color: var(--aicd-accent, #4d6bfe);
  outline: 1px solid var(--aicd-accent, #4d6bfe);
  outline-offset: -1px;
}

/* ----------------------------------------------------------------- cards -- */

/* One elevated surface per view: the counter and the one button that moves it.
 * Everything under it sits flat on the page, separated by space rather than by
 * another box, so the eye has one place to land first. */
.aicd-protect > * + * {
  margin-top: var(--aicd-s4, 22px);
}

.aicd-stat {
  display: flex;
  flex-direction: column;
  gap: var(--aicd-s2, 8px);
  padding: var(--aicd-s3, 14px);
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: var(--aicd-card-radius, 16px);
  background: var(--aicd-surface, rgba(127,127,127,0.05));
}

.aicd-stat-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.aicd-stat-num {
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font-size: var(--aicd-fs-hero, 30px);
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.aicd-stat-num[data-tone="good"] {
  color: var(--dsw-alias-state-success-primary, #3f9c6a);
}

.aicd-stat-num[data-tone="warn"] {
  color: var(--dsw-alias-state-warn-primary, #c98a1f);
}

.aicd-stat-num[data-tone="bad"] {
  color: var(--dsw-alias-state-error-primary, #c94a4a);
}

.aicd-stat-lead {
  font-size: 15px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #1b1b1f);
}

.aicd-stat-label {
  min-width: 0;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 12px;
  line-height: 1.45;
}

.aicd-stat-sub {
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: var(--aicd-fs-meta, 12px);
  line-height: 1.45;
}

.aicd-stat-meta {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.aicd-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 0;
  border: none;
  border-radius: 0;
}

.aicd-hint-text {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 12px;
  line-height: 1.45;
}

.aicd-legend {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0 0 0 2px;
  border: none;
  border-radius: 0;
  background: none;
  font-size: var(--aicd-fs-eyebrow, 11px);
  line-height: 1.45;
}

.aicd-legend-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 11px;
  line-height: 1.5;
}

.aicd-legend-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-label-tertiary, #8b8b8b);
}

.aicd-legend-dot[data-tone="noise"] {
  background: var(--dsw-alias-state-warn-primary, #d9a341);
}

.aicd-legend-dot[data-tone="review"] {
  background: var(--dsw-alias-state-business-primary, #4d6bfe);
}

.aicd-legend-label {
  flex: none;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-weight: 600;
}

.aicd-legend-text {
  min-width: 0;
}

/* Grouping, not decoration: a bigger gap starts a new group, a small one only
 * separates lines inside it. The two lists inside the file body are separate
 * groups; the rows inside each are not. */
.aicd-files .aicd-body > div + div {
  margin-top: var(--aicd-s3, 14px);
}

.aicd-files .aicd-body > div + div > .aicd-list-head:first-child {
  margin-top: var(--aicd-s1, 4px);
}

.aicd-files > .aicd-legend {
  margin-top: calc(var(--aicd-s1, 4px) * -1);
  margin-bottom: var(--aicd-s1, 4px);
}

.aicd-files > .aicd-suggest {
  margin-bottom: var(--aicd-s2, 8px);
}

.aicd-suggest {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aicd-suggest-hint {
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 11px;
  line-height: 1.5;
}

.aicd-suggest-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.aicd-suggest-rules .aicd-chip {
  border-color: var(--aicd-line, rgba(127,127,127,0.16));
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
}

.aicd-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--aicd-surface, rgba(127,127,127,0.05));
}

.aicd-result-score {
  color: var(--dsw-alias-state-success-primary, #3f9c6a);
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.aicd-covered {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 11px;
}

.aicd-covered li {
  display: flex;
  gap: 6px;
  align-items: baseline;
  min-width: 0;
}

.aicd-covered-name {
  overflow: hidden;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Optimize in three named steps. A percentage bar would have to invent numbers
   the Host never reports; a step is only marked done once its request returns. */
.aicd-steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.aicd-step {
  display: flex;
  align-items: center;
  gap: var(--aicd-s2, 8px);
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: var(--aicd-fs-eyebrow, 11px);
  line-height: 1.6;
}

.aicd-step-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  flex: none;
  font-size: 10px;
}

.aicd-step-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-step[data-state="active"] {
  color: var(--dsw-alias-label-primary, #1f1f1f);
}

.aicd-step[data-state="active"] .aicd-step-mark::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--dsw-alias-state-business-primary, #4176e6);
  animation: aicd-pulse 1.2s ease-in-out infinite;
}

.aicd-step[data-state="done"] {
  color: var(--dsw-alias-state-success-secondary, #4d9970);
}

@media (prefers-reduced-motion: reduce) {
  .aicd-step[data-state="active"] .aicd-step-mark::before {
    animation: none;
  }
}

.aicd-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  text-align: center;
}

.aicd-empty-icon {
  color: var(--dsw-alias-label-quaternary, #b9b9b9);
}

.aicd-empty-title {
  margin: 0;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 13px;
  font-weight: 500;
}

.aicd-empty-hint {
  max-width: 260px;
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 12px;
  line-height: 1.5;
}

.aicd-state {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 2px;
}

.aicd-state[aria-busy="true"] {
  padding: 4px 0;
}

.aicd-state-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aicd-state-detail {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
}

.aicd-state-inline {
  padding: 6px 8px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--aicd-surface, rgba(127,127,127,0.05));
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 11px;
  line-height: 1.5;
}

.aicd-state-inline[data-tone="bad"] {
  color: var(--dsw-alias-state-error-primary, #c94a4a);
}

.aicd-state-skel,
.aicd-skel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aicd-skel-row {
  height: 12px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-skeleton, rgba(127, 127, 127, 0.14));
  animation: aicd-pulse 1.4s ease-in-out infinite;
}

.aicd-skel-row:nth-child(2n) {
  width: 72%;
}

@keyframes aicd-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

/* ---------------------------------------------------------------- detail -- */

.aicd-detail {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: var(--aicd-card-radius, 16px);
  background: var(--aicd-surface, rgba(127,127,127,0.05));
}

.aicd-detail-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.aicd-detail-name {
  overflow: hidden;
  flex: 1;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-kv {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 2px 8px;
  margin: 0;
  font-size: 11px;
}

.aicd-kv dt {
  color: var(--dsw-alias-label-caption, #9a9a9a);
}

.aicd-kv dd {
  margin: 0;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

/* --------------------------------------------------------- diagnostics -- */

/* A fold at the foot of Settings: the facts a bug report needs, and nothing
 * that should not be pasted in public. */
.aicd-diag {
  padding-top: var(--aicd-s3, 14px);
  border-top: 0.5px solid var(--aicd-hairline, rgba(127, 127, 127, 0.2));
}

.aicd-diag-rows {
  margin: 0;
}

.aicd-diag .aicd-kv {
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 3px var(--aicd-s2, 8px);
  font-size: var(--aicd-fs-eyebrow, 11px);
}

.aicd-diag-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-diag-loading {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: var(--aicd-fs-eyebrow, 11px);
}

/* ------------------------------------------------------------ rules etc. -- */

.aicd-rules {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aicd-rule {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  padding: 1px 4px 1px 0;
  border-radius: var(--dsw-radius-sm, 8px);
}

.aicd-rule:hover {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
}

.aicd-rule-text {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-rule-x {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  cursor: pointer;
}

.aicd-rule-x:hover {
  background: var(--aicd-active, rgba(127,127,127,0.16));
  color: var(--dsw-alias-state-error-primary, #c94a4a);
}

.aicd-notes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aicd-injected {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  line-height: 16px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.aicd-note {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 12px;
  line-height: 1.5;
}

.aicd-note[data-tone="ok"] {
  color: var(--dsw-alias-state-success-primary, #3f9c6a);
}

.aicd-note[data-tone="bad"] {
  color: var(--dsw-alias-state-error-primary, #c94a4a);
}

.aicd-fold {
  border-top: 0.5px solid var(--aicd-hairline, rgba(127,127,127,0.2));
  padding-top: 8px;
}

.aicd-fold-head {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.aicd-fold-head:hover {
  color: var(--dsw-alias-label-secondary, #6b6b6b);
}

.aicd-fold-body {
  margin: 6px 0 0;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 11px;
  line-height: 1.6;
}

.aicd-bar-row {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 52px;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.aicd-bar-name {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-bar {
  height: 4px;
  border-radius: 999px;
  background: var(--aicd-active, rgba(127,127,127,0.16));
  overflow: hidden;
}

.aicd-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--dsw-alias-state-warn-primary, #d9a341);
}

.aicd-bar-loss {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

/* -------------------------------------------------------------- strength -- */

.aicd-strength {
  display: flex;
  flex-direction: column;
  gap: var(--aicd-s1, 4px);
  margin-top: var(--aicd-s4, 22px);
  padding-top: 0;
  border-top: none;
}

.aicd-strength-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aicd-strength-now {
  margin-left: auto;
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
}

.aicd-strength-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
}

.aicd-strength-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 2px;
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  cursor: pointer;
}

.aicd-strength-cell:hover:not(:disabled) {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
}

.aicd-strength-cell[data-active="true"] {
  border-color: var(--aicd-accent, #4d6bfe);
  background: var(--dsw-alias-state-business-tertiary, rgba(77, 107, 254, 0.1));
  color: var(--dsw-alias-label-primary, #1b1b1f);
}

.aicd-strength-cell:disabled {
  opacity: 0.6;
  cursor: default;
}

.aicd-strength-num {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 10px;
  line-height: 1.2;
}

.aicd-strength-score {
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.aicd-strength-hint {
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 11px;
  line-height: 1.5;
}

.aicd-strength-state {
  padding: 8px 0;
}

/* ----------------------------------------------------------- opt blocks -- */

.aicd-opt {
  display: flex;
  flex-direction: column;
  gap: var(--aicd-s2, 8px);
  padding: var(--aicd-s3, 14px) 0 var(--aicd-s2, 8px);
  border-top: 0.5px solid var(--aicd-hairline, rgba(127,127,127,0.2));
}

.aicd-opt:last-child {
  padding-bottom: 0;
}

/* A pointer to the tab that owns the control: one row, no paragraph. */
.aicd-opt-row {
  flex-direction: row;
  align-items: center;
  gap: var(--aicd-s2, 8px);
  padding-top: var(--aicd-s3, 14px);
  border-top: none;
}

.aicd-opt-row .aicd-count {
  margin-left: auto;
}

.aicd-opt:first-child {
  padding-top: 0;
  border-top: none;
}

.aicd-opt-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aicd-opt-head .aicd-count {
  margin-left: auto;
}

.aicd-opt-title {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* --------------------------------------------------------------- menu ---- */

.aicd-menu {
  position: absolute;
  z-index: 3;
  top: 30px;
  right: 0;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  padding: 4px;
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-base, #fff);
  box-shadow: var(--dsw-elevation-panel, 0 8px 24px rgba(0, 0, 0, 0.14));
}

.aicd-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 4px 8px;
  border: none;
  border-radius: var(--dsw-radius-sm, 8px);
  background: none;
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.aicd-menu-item:hover {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
}

.aicd-menu-item[aria-disabled="true"] {
  color: var(--dsw-alias-label-quaternary, #b9b9b9);
  cursor: default;
}

.aicd-menu-item[aria-disabled="true"]:hover {
  background: none;
}

.aicd-card-value {
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.aicd-card-value[data-tone="good"] {
  color: var(--dsw-alias-state-success-primary, #3f9c6a);
}

.aicd-card-value[data-tone="warn"] {
  color: var(--dsw-alias-state-warn-primary, #c98a1f);
}

.aicd-card-label {
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 11px;
  line-height: 1.5;
}

/* A file the panel suggests acting on: icon, two lines of text, and the
   buttons that only appear when the row is under the pointer. */
.aicd-item {
  display: flex;
  align-items: center;
  gap: var(--aicd-s2, 8px);
  padding: 5px 8px;
  border-radius: var(--aicd-row-radius, 12px);
}

.aicd-item:hover {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
}

.aicd-item-icon {
  display: inline-flex;
  flex: none;
  color: var(--dsw-alias-state-warn-primary, #d9a341);
}

.aicd-item-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.aicd-item-name {
  overflow: hidden;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-item-meta {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.aicd-item-actions {
  display: flex;
  flex: none;
  gap: 4px;
  opacity: 0;
  transition: opacity 120ms ease;
}

.aicd-item:hover .aicd-item-actions,
.aicd-item:focus-within .aicd-item-actions {
  opacity: 1;
}

@media (hover: none) {
  .aicd-item-actions {
    opacity: 1;
  }
}

/* --------------------------------------------------------------- files ---- */

.aicd-files {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: 8px;
  box-sizing: border-box;
  padding: 10px 16px 0;
}

.aicd-files > .aicd-body {
  padding: 2px 0 20px;
}

.aicd-files > .aicd-note {
  flex: none;
}

.aicd-protect {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* --------------------------------------------------------- overlay shell -- */

.aicd-overlay {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 380px;
  max-height: 70vh;
  overflow: hidden;
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: var(--aicd-card-radius, 16px);
  background: var(--dsw-alias-bg-base, #fff);
  box-shadow: var(--dsw-elevation-panel, 0 12px 32px rgba(0, 0, 0, 0.18));
}

.aicd-overlay-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 6px 0 16px;
  border-bottom: 0.5px solid var(--aicd-hairline, rgba(127,127,127,0.2));
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 12px;
  font-weight: 500;
}

.aicd-overlay .aicd-panel {
  flex: 1;
  min-height: 0;
}

/* --------------------------------------------------------- composer entry -- */

.aicd-entry {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  cursor: pointer;
}

.aicd-entry:hover {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
  color: var(--dsw-alias-label-primary, #1b1b1f);
}

.aicd-entry[data-blocked="true"]::after {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--dsw-alias-state-warn-primary, #d9a341);
  content: "";
}

/* --------------------------------------------------------- workspace pick -- */

.aicd-pick {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aicd-pick-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 8px 10px;
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: var(--dsw-radius-sm, 8px);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.aicd-pick-row:hover {
  background: var(--aicd-hover, rgba(127,127,127,0.1));
}

.aicd-pick-name {
  font-weight: 500;
}

.aicd-pick-meta {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
}

/* -------------------------------------------------------- left overview --- */

.aicd-page {
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: 1.5;
}

.aicd-page-inner {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}

.aicd-page-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.aicd-page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.aicd-page-hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  font-size: 12px;
  line-height: 1.6;
}

.aicd-page-meta {
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.aicd-page-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 0.5px solid var(--aicd-line, rgba(127,127,127,0.16));
  border-radius: var(--aicd-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.04));
}

.aicd-page-score {
  flex: none;
  min-width: 34px;
  color: var(--dsw-alias-label-primary, #1b1b1f);
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.aicd-page-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.aicd-page-name {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-page-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--aicd-surface, rgba(127,127,127,0.05));
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  font-size: 11px;
}

.aicd-page-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}

/* ------------------------------------------------------- focus & motion --- */

.aicd-panel :focus-visible,
.aicd-entry:focus-visible,
.aicd-page :focus-visible {
  outline: 2px solid var(--aicd-accent, #4d6bfe);
  outline-offset: 1px;
}

.aicd-panel button:focus-visible,
.aicd-page button:focus-visible {
  outline-offset: 0;
}

@media (prefers-reduced-motion: reduce) {
  .aicd-skel-row,
}

/* A conversation with nothing to hold back shows what it did read, not a 0. */

/* The strength ladder lives behind a disclosure now: the first screen offers a
   score and one button, and the notches are an answer to "and if I want more?" */
.aicd-strength-fold {
  margin-top: var(--aicd-s4, 22px);
}
.aicd-strength-fold > .aicd-fold-head {
  padding: 0;
  border-top: 0;
}
.aicd-strength-fold .aicd-strength {
  margin-top: 10px;
  border-top: 0;
  padding-top: 0;
}
.aicd-strength-head-plain {
  padding: 0 0 6px;
  border-top: 0;
  min-height: 0;
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
      spark: 'M8 2.2 9.4 6.4 13.6 8 9.4 9.6 8 13.8 6.6 9.6 2.4 8 6.6 6.4 8 2.2Z',
      check: 'M3.4 8.4 6.4 11.4 12.6 5'
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

    /**
     * Fill `{name}` slots in a label. Copy stays one sentence in each language
     * instead of being assembled from fragments that only read well in English.
     */
    function fill(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
      ));
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

    /** A conversation reports its tokens per surface; the cards want one number. */
    function tokenTotal(tokens) {
      if (typeof tokens === 'number') return tokens;
      if (tokens === null || typeof tokens !== 'object') return 0;
      let total = 0;
      for (const value of Object.values(tokens)) {
        if (typeof value === 'number') total += value;
      }
      return total;
    }

    /** Token amounts arrive as a range from the scanner and as plain counts from
     *  the counters; both belong on screen as one short string. */
    /** Turn whatever a failed fetch threw into something a person can read. */
    function errorMessage(error) {
      if (error === null || error === undefined) return '';
      if (typeof error === 'string') return error;
      if (typeof error.message === 'string') return error.message;
      return String(error);
    }

    function shortTokens(value) {
      if (typeof value === 'number') {
        const count = Math.max(0, Math.round(value));
        return count >= 10000 ? `${Math.round(count / 1000)}k` : count.toLocaleString();
      }
      return formatTokensCompact(value).replace(/^~/, '');
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

    /**
     * The slot body is rendered by the Host with the session it belongs to. Read
     * that session's directory; when the framework does not hand us one (an
     * older Host, the preview page, a test), the panel falls back to whatever the
     * Host half has scanned.
     */
    function sessionCwd(props) {
      const holder = props === null || props === undefined ? null : props;
      if (holder === null) return undefined;
      const useSessions = holder.useSessions;
      const sessionId = holder.sessionId;
      if (typeof useSessions !== 'function' || typeof sessionId !== 'string' || sessionId === '') return undefined;
      let cwd;
      try {
        cwd = useSessions((sessions) => (sessions && sessions.byId ? (sessions.byId[sessionId] || {}).cwd : undefined));
      } catch {
        return undefined;
      }
      return typeof cwd === 'string' && cwd.length > 0 ? cwd : undefined;
    }

    //#endregion helpers

    /** One number, short enough for a row. */
    function bytesShort(value) {
      if (typeof value !== 'number' || Number.isFinite(value) !== true) return '—';
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
      if (value >= 1024) return `${Math.round(value / 1024)} KB`;
      return `${value} B`;
    }

    /**
     * The conversation in front of the user, read from the app's own projection:
     * its title, what it read, and what those reads cost. `pinnedSession` lets the
     * user look at another conversation without leaving this one.
     */
    function useConversation(sessionId, nonce) {
      const [conv, setConv] = useState(null);
      const [error, setError] = useState(null);
      const [tick, setTick] = useState(0);

      useEffect(() => {
        let live = true;
        // Always name the conversation. Without an id the Host half answers with
        // "the session that wrote last", which is wrong the moment the user
        // switches back to an older conversation: switching does not write.
        const target = typeof sessionId === 'string' && sessionId.length > 0
          ? `/aiignore/conversation?session=${encodeURIComponent(sessionId)}`
          : '/aiignore/conversation';
        fetch(target, { headers: { accept: 'application/json' } })
          // Keep the status: "unavailable" told the reader nothing, while the
          // status is the one fact that says whether retrying can help.
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            if (!live) return;
            if (payload === null || typeof payload !== 'object' || payload.error !== undefined) {
              setError({ message: typeof payload.error === 'string' ? payload.error : 'no conversation' });
              return;
            }
            setConv(payload);
            setError(null);
          })
          .catch((caught) => {
            if (live) setError(caught);
          });
        const timer = setInterval(() => setTick((value) => value + 1), 5000);
        return () => {
          live = false;
          clearInterval(timer);
        };
        // `nonce` is bumped by the actions that change what is covered —
        // Optimize, a new notch, a rescan. Without it the counter kept the
        // numbers from before the click until the next poll, which is exactly
        // the "nothing happened" the page was accused of.
      }, [sessionId, tick, nonce]);

      return { conv, error };
    }

    /**
     * The five notches, scored, in one request.
     *
     * Both the strip on Protection and anything else that shows the ladder read
     * from here, so they cannot disagree about what a notch would cost.
     */
    function useLevels(cwd) {
      const [levels, setLevels] = useState(null);
      const [failed, setFailed] = useState(null);
      const [attempt, setAttempt] = useState(0);

      useEffect(() => {
        if (typeof cwd !== 'string' || cwd === '') return undefined;
        let live = true;
        setFailed(null);
        fetch(`/aiignore/levels?cwd=${encodeURIComponent(cwd)}`, { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            if (live === true) setLevels(Array.isArray(payload.levels) ? payload.levels : []);
          })
          .catch((reason) => {
            if (live === true) setFailed(reason === undefined || reason === null ? new Error('unknown') : reason);
          });
        return () => {
          live = false;
        };
      }, [cwd, attempt]);

      return {
        levels,
        failed,
        retry: () => {
          setFailed(null);
          setLevels(null);
          setAttempt((value) => value + 1);
        }
      };
    }

    //#region components
    let stylesInjected = false;
    // Which surface this install actually got. Set when the tab registers;
    // Diagnostics reports it so a screenshot and a bug report agree.
    let SURFACE = 'overlay';
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

    function Skeleton({ rows }) {
      const widths = ['72%', '54%', '81%', '46%', '64%'].slice(0, typeof rows === 'number' && rows > 0 ? rows : 5);
      return h('div', { 'aria-busy': 'true' },
        widths.map((width, index) =>
          h('div', { key: index, className: 'aicd-skel-row' },
            h('div', { className: 'aicd-skel', style: { width: 12, height: 12 } }),
            h('div', { className: 'aicd-skel', style: { width } })
          )
        )
      );
    }

    /**
     * The reason a request failed, in the few words a reader can act on. A
     * status code is the truth; "something went wrong" is not.
     */
    function reasonOf(error) {
      if (error === null || error === undefined) return 'unknown';
      const message = typeof error.message === 'string' && error.message.length > 0 ? error.message : String(error);
      if (message === 'Failed to fetch' || message === 'Load failed') return 'network';
      return message;
    }

    /**
     * One renderer for the three things a request can be: still loading, empty,
     * or failed. Before this each surface invented its own — the strength table
     * simply disappeared while it loaded, a failed conversation lookup looked
     * like "no conversation", and a 500 was reported as "cannot reach the
     * server". A failure now always names its own reason and offers the retry.
     */
    function State({ kind, icon, title, errorTitle, hint, action, error, onRetry, retryLabel, rows }) {
      if (kind === 'loading') {
        return h('div', { className: 'aicd-state', 'aria-busy': 'true' },
          h('div', { className: 'aicd-state-skel' }, h(Skeleton, { rows: rows }))
        );
      }
      const failed = kind === 'error';
      return h('div', { className: 'aicd-state' },
        h(Empty, {
          icon: failed ? 'warn' : (icon === undefined ? 'folder' : icon),
          title: failed ? (errorTitle === undefined ? tr('errorTitle') : errorTitle) : title,
          hint: failed ? (hint === undefined ? tr('errorHint') : hint) : hint,
          action: failed
            ? h('div', { className: 'aicd-state-actions' },
                onRetry === undefined
                  ? null
                  : h('button', { type: 'button', className: 'aicd-btn', onClick: onRetry },
                      retryLabel === undefined ? tr('retry') : retryLabel),
                h('div', { className: 'aicd-state-detail' }, `${tr('errorStatus')} ${reasonOf(error)}`))
            : action
        })
      );
    }

    function useReport(cwd) {
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [at, setAt] = useState('');
      const [tree, setTree] = useState(null);
      // The panel names the workspace it belongs to: the Host half cannot always
      // work it out on its own, and this is the one fact the conversation knows.
      const suffix = typeof cwd === 'string' && cwd.length > 0 ? `?cwd=${encodeURIComponent(cwd)}` : '';

      const loadReport = useCallback(() => {
        fetch(`/aiignore/report${suffix}`, { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setData(payload);
            setError(null);
          })
          .catch((reason) => setError(reason));
      }, [suffix]);

      const loadTree = useCallback((dir) => {
        const sep = suffix === '' ? '?' : '&';
        fetch(`/aiignore/tree?dir=${encodeURIComponent(dir)}${suffix === '' ? '' : `${sep}cwd=${encodeURIComponent(cwd)}`}`, { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setTree(payload);
            setError(null);
          })
          .catch((reason) => setError(reason));
      }, [suffix]);

      useEffect(() => {
        loadReport();
        const timer = setInterval(loadReport, 5000);
        return () => clearInterval(timer);
      }, [loadReport]);

      useEffect(() => {
        loadTree(at);
      }, [at, loadTree]);

      const applyReport = useCallback((payload) => {
        if (payload !== null && payload !== undefined) {
          setData(payload);
          setError(null);
        }
      }, []);

      return { data, error, at, setAt, tree, reload: loadReport, reloadTree: () => loadTree(at), applyReport };
    }

    function Detail({ item, pending, onAllow, onIgnore, onAddRule }) {
      if (item === null || item === undefined) return null;
      const reason = typeof item.reason === 'string' && item.reason.length > 0 ? item.reason : null;
      const badge = item.ignored === true
        ? { text: tr('badgeIgnored'), tone: 'neutral' }
        : item.badge === 'noise'
          ? { text: reason === null ? tr('badgeNoise') : `${tr('badgeNoise')} · ${reason}`, tone: 'noise' }
          : item.badge === 'review'
            ? { text: reason === null ? tr('badgeReview') : `${tr('badgeReview')} · ${reason}`, tone: 'review' }
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
              // The wider rule first: `dist/` retires a whole folder, and the
              // per-file line is what makes .aiignore unreadable after a week.
              item.suggestion !== null && item.suggestion !== undefined && item.suggestion !== item.path
                ? h('button', {
                    type: 'button',
                    className: 'aicd-btn',
                    'data-variant': 'primary',
                    title: tr('suggestHint'),
                    disabled: pending === item.path,
                    onClick: () => onIgnore(item.path, undefined, item.suggestion)
                  }, `${tr('suggestAdd')} ${item.suggestion}`)
                : null,
              h('button', {
                type: 'button',
                className: 'aicd-btn',
                'data-variant': item.suggestion === null || item.suggestion === undefined || item.suggestion === item.path ? 'primary' : undefined,
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
    function FilesView({ data, tree, at, setAt, pending, onAllow, onIgnore, onAddRule, lastIgnored, onUndo }) {
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

      // What the chips mean, said once in plain words. The definitions are the
      // classifier's own criteria, not a second opinion: a reader who disagrees
      // with a badge should be able to see the rule that produced it.
      const legend = [
        { tone: 'noise', label: tr('badgeNoise'), text: tr('legendNoise') },
        { tone: 'review', label: tr('badgeReview'), text: tr('legendReview') },
        { tone: 'neutral', label: tr('badgeIgnored'), text: tr('legendIgnored') }
      ];

      // Rules this workspace would still benefit from: the scanner's suggestions
      // minus the lines that are already written.
      const written = Array.isArray(data.rules) ? data.rules : [];
      const suggestions = (Array.isArray(data.scanned !== undefined && data.scanned !== null ? data.scanned.suggestedAiignore : null)
        ? data.scanned.suggestedAiignore
        : []).filter((rule) => written.includes(rule) === false);

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
          h('div', { className: 'aicd-filters' },
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
        h('div', { className: 'aicd-legend' },
          legend.map((item) =>
            h('div', { key: item.label, className: 'aicd-legend-row' },
              h('span', { className: 'aicd-legend-dot', 'data-tone': item.tone }),
              h('span', { className: 'aicd-legend-label' }, item.label),
              h('span', { className: 'aicd-legend-text' }, item.text)
            )
          )
        ),
        suggestions.length === 0
          ? null
          : h('div', { className: 'aicd-suggest' },
              h('div', { className: 'aicd-list-head' },
                h('span', { className: 'aicd-list-title' }, tr('suggestTitle')),
                h('span', { className: 'aicd-list-count' }, String(suggestions.length))
              ),
              h('div', { className: 'aicd-suggest-hint' }, tr('suggestHint')),
              h('div', { className: 'aicd-suggest-rules' },
                suggestions.map((rule) =>
                  h('button', {
                    key: rule,
                    type: 'button',
                    className: 'aicd-chip',
                    disabled: pending === rule,
                    title: tr('suggestAdd'),
                    onClick: () => onAddRule(rule)
                  }, `+ ${rule}`)
                )
              )
            ),
        picked.length > 1
          ? h('div', { className: 'aicd-subbar' },
              h('button', {
                key: 'batch',
                type: 'button',
                className: 'aicd-btn',
                'data-variant': 'primary',
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
              }, tr('batchIgnore').replace('{n}', String(picked.length))),
              h('button', {
                key: 'clear',
                type: 'button',
                className: 'aicd-btn',
                onClick: () => setPicked([])
              }, tr('batchClear'))
            )
          : null,
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
                h('div', { className: 'aicd-list-head' },
                  h('span', { className: 'aicd-list-title' }, tr('sessionTitle')),
                  h('span', { className: 'aicd-list-count' }, String(sessionFiles.length))
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
          h('div', { className: 'aicd-list-head' },
            h('span', { className: 'aicd-list-title' }, tr('workspaceTitle')),
            at === '' ? null : h('span', { className: 'aicd-list-path', title: at }, at),
            h('button', {
              key: 'sort',
              type: 'button',
              className: 'aicd-sortbtn',
              'aria-label': tr('sortSize'),
              onClick: () => setSort(sort === 'size' ? 'name' : 'size')
            }, sort === 'size' ? tr('sortSize') : tr('sortName'), ' ▾')
          ),
          h('div', { className: 'aicd-crumbs' }, crumbs),
          tree === null
            ? h(Skeleton, null)
            : entries.length === 0
              // An empty filter is not an empty folder: say which filter, and
              // give the way back in one click.
              ? h(Empty, {
                  icon: filter === 'all' ? 'folder' : 'search',
                  title: query !== ''
                    ? tr('noMatch')
                    : filter === 'all'
                      ? tr('emptyDir')
                      : `${tr('noMatch')} ${(filters.find(([id]) => id === filter) || ['', ''])[1]}`,
                  hint: at === '' ? data.workspace : undefined,
                  action: filter === 'all' && query === ''
                    ? null
                    : h('button', {
                        type: 'button',
                        className: 'aicd-btn',
                        onClick: () => { setFilter('all'); setQuery(''); }
                      }, tr('filterAll'))
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
          onIgnore: (target, after, rule) => onIgnore(target, after === undefined ? clearSelection : after, rule)
        })
      );
    }

    /** Where the score comes from, category by category. */
    function ScoreBreakdown({ rows, lost, title, formula }) {
      const list = Array.isArray(rows) ? rows : [];
      return h('div', { className: 'aicd-opt' },
        h('div', { className: 'aicd-opt-head' },
          h('span', { className: 'aicd-opt-title' }, title),
          h('span', { className: 'aicd-count' }, typeof lost === 'number' ? `−${lost}` : '')
        ),
        list.map((row) =>
          h('div', { key: row.id, className: 'aicd-bar-row', title: row.hint === undefined ? undefined : row.hint },
            h('span', { className: 'aicd-bar-name' }, row.label),
            h('div', { className: 'aicd-bar' },
              h('div', {
                className: 'aicd-bar-fill',
                style: { width: `${row.weight > 0 ? Math.min(100, Math.round((row.lost / row.weight) * 100)) : 0}%` },
                'data-empty': row.lost === 0 ? 'true' : 'false'
              })
            ),
            h('span', { className: 'aicd-bar-loss' }, `${row.lost} / ${row.weight}`)
          )
        ),
        h('details', { className: 'aicd-fold' },
          h('summary', { className: 'aicd-fold-head' }, tr('scoreHow')),
          h('p', { className: 'aicd-fold-body' }, formula)
        )
      );
    }

    //#endregion views

    //#region score

    /**
     * The one click that actually writes something.
     *
     * It says what it is about to write before you press it, then reports the
     * number it moved and names the files that stopped being noise — a button
     * that only claims success is a button you learn to distrust.
     */
    function OptimizeCard({ data, conv, onDone, onOptimized }) {
      const [busy, setBusy] = useState(false);
      const [result, setResult] = useState(null);
      const convRules = conv !== null && conv !== undefined && Array.isArray(conv.suggestedAiignore) ? conv.suggestedAiignore : [];
      const scannedRules = data.scanned !== undefined && data.scanned !== null && Array.isArray(data.scanned.suggestedAiignore)
        ? data.scanned.suggestedAiignore
        : [];
      const suggested = convRules.length > 0 ? convRules : scannedRules;
      const session = conv !== null && conv !== undefined && typeof conv.id === 'string' ? conv.id : null;

      const run = () => {
        setBusy(true);
        setResult(null);
        fetch('/aiignore/optimize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(session === null ? {} : { session })
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setResult(payload);
            if (typeof onOptimized === 'function') onOptimized(payload);
            else if (typeof onDone === 'function') onDone();
          })
          .catch(() => setResult({ error: true }))
          .then(() => setBusy(false));
      };

      const undo = () => {
        setBusy(true);
        fetch('/aiignore/optimize/undo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
          .then(() => {
            setResult(null);
            if (typeof onDone === 'function') onDone();
          })
          .catch(() => {})
          .then(() => setBusy(false));
      };

      const added = result !== null && Array.isArray(result.added) ? result.added : [];
      const covered = result !== null && Array.isArray(result.covered) ? result.covered : [];
      const nothingToAdd = result !== null && result.error !== true && added.length === 0;
      const moved = result !== null && result.error !== true && added.length > 0;

      return h('div', { className: 'aicd-opt' },
        h('div', { className: 'aicd-opt-head' },
          h('span', { className: 'aicd-opt-title' }, tr('optimizeTitle')),
          suggested.length > 0 ? h('span', { className: 'aicd-count' }, `${suggested.length}`) : null
        ),
        h('div', { className: 'aicd-note' }, session === null ? tr('optimizeHint') : tr('optimizeConversationHint')),
        suggested.length > 0
          ? h('div', { className: 'aicd-chips' },
              suggested.slice(0, 8).map((rule) => h('span', { key: rule, className: 'aicd-chip', 'data-static': 'true' }, rule)))
          : null,
        moved === true
          ? h('div', { className: 'aicd-result' },
              h('div', { className: 'aicd-result-score' },
                h('span', { className: 'aicd-card-value', 'data-tone': toneFor(result.after) }, String(result.after)),
                h('span', { className: 'aicd-card-label' }, `${tr('scoreMoved')} ${result.before} → ${result.after}`)
              ),
              h('div', { className: 'aicd-note', 'data-tone': 'ok' }, `${tr('optimized')} ${added.join(', ')}`),
              covered.length === 0
                ? null
                : h('div', { className: 'aicd-covered' },
                    h('div', { className: 'aicd-section-title' }, `${tr('coveredTitle')} · ${covered.length}`),
                    covered.map((item) =>
                      h('div', { key: item.path, className: 'aicd-row', 'data-static': 'true' },
                        h(Icon, { name: 'lock', size: 14 }),
                        h('span', { className: 'aicd-row-name' }, item.path),
                        h('span', { className: 'aicd-row-meta' }, formatBytes(item.bytes))
                      )
                    )
                  ),
              h('div', { className: 'aicd-btn-row' },
                h('button', { type: 'button', className: 'aicd-btn', disabled: busy, onClick: undo }, tr('undoOptimize'))
              )
            )
          : result !== null && result.error === true
            ? h('div', { className: 'aicd-note', 'data-tone': 'bad' }, tr('optimizeFailed'))
            : nothingToAdd === true
              ? h('div', { className: 'aicd-note' }, tr('optimizeUpToDate'))
              : suggested.length === 0
                ? h('div', { className: 'aicd-note' }, tr('optimizeNone'))
                : h('div', { className: 'aicd-btn-row' },
                    h('button', {
                      type: 'button',
                      className: 'aicd-btn',
                      'data-variant': 'primary',
                      disabled: busy ? 'true' : undefined,
                      onClick: run
                    }, busy === true ? tr('working') : (session === null ? tr('optimize') : tr('optimizeConversation')))
                  )
      );
    }

    /**
     * The Score tab, in the order the decision is actually made: what this
     * conversation cost, what your rules leave behind, why, how strict you want
     * to be, and the one click that writes the rules — with the number it moved.
     */
    /**
     * Everything you can change. Kept off the first screen on purpose: the
     * question that panel answers is "is this thing doing anything", and a
     * setting has no business in that answer.
     */
    function RulesCard({ data, onDone }) {
      const rules = Array.isArray(data.rules) ? data.rules : [];
      const [busy, setBusy] = useState(null);
      const [notice, setNotice] = useState(null);

      const remove = (rule) => {
        setBusy(rule);
        setNotice(null);
        fetch('/aiignore/rules/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rule })
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then(() => {
            setNotice(tr('rulesRemoved'));
            if (typeof onDone === 'function') onDone();
          })
          .catch(() => setNotice(tr('noteFailed')))
          .then(() => setBusy(null));
      };

      return h('div', { className: 'aicd-opt' },
        h('div', { className: 'aicd-opt-head' },
          h('span', { className: 'aicd-opt-title' }, tr('rulesTitle')),
          h('span', { className: 'aicd-count' }, String(rules.length))
        ),
        h('div', { className: 'aicd-note' }, tr('rulesHint')),
        rules.length === 0
          ? h('div', { className: 'aicd-note' }, tr('rulesNone'))
          : h('div', { className: 'aicd-rules' },
              rules.map((rule) => h('span', { className: 'aicd-rule', key: rule },
                h('code', { className: 'aicd-rule-text' }, rule),
                h('button', {
                  type: 'button',
                  className: 'aicd-rule-x',
                  title: tr('rulesRemove'),
                  'aria-label': `${tr('rulesRemove')}: ${rule}`,
                  disabled: busy === rule,
                  onClick: () => remove(rule)
                }, '×')
              ))
            ),
        notice === null ? null : h('div', { className: 'aicd-note', 'data-tone': notice === tr('rulesRemoved') ? 'ok' : 'bad' }, notice)
      );
    }

    /**
     * The note the agent reads before it starts. The point of this block is that
     * you can see the exact text that will be injected: the three toggles add a
     * sentence each, and the monospace block under them is what the model gets.
     */
    function NoteView({ data, onSaved }) {
      const [notes, setNotes] = useState(null);
      const [status, setStatus] = useState(null);
      const value = notes === null ? (typeof data.notes === 'string' ? data.notes : '') : notes;
      const length = value.length;

      const toggle = (snippet) => {
        const has = value.includes(snippet);
        let next;
        if (has === true) {
          next = value.split(snippet).join('').replace(/\n{3,}/g, '\n\n').trim();
        } else {
          next = value.trim().length === 0 ? snippet : `${value.replace(/\s+$/, '')}\n${snippet}`;
        }
        setNotes(next.slice(0, 4000));
        setStatus(null);
      };

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

      const injected = value.trim().length === 0
        ? ''
        : ['The user left a note for this workspace in .aiignore.notes.md:', '', value.trim(), '', 'Treat it as project context from the user, not as a tool result.'].join('\n');

      return h('div', { className: 'aicd-notes' },
        h('div', { className: 'aicd-section-title' }, tr('noteTitle')),
        h('p', { className: 'aicd-note' }, tr('noteWhy')),
        h('div', { className: 'aicd-chips', role: 'group', 'aria-label': tr('noteTitle') },
          TEMPLATES.map((template) =>
            h('button', {
              key: template.id,
              type: 'button',
              className: 'aicd-chip',
              'data-active': value.includes(tr(template.key)) ? 'true' : 'false',
              'aria-pressed': value.includes(tr(template.key)) ? 'true' : 'false',
              onClick: () => toggle(tr(template.key))
            }, tr(template.labelKey))
          )
        ),
        h('textarea', {
          className: 'aicd-textarea',
          rows: 3,
          value,
          placeholder: tr('notePlaceholder'),
          'aria-label': tr('noteTitle'),
          onChange: (event) => {
            setNotes(event.target.value);
            setStatus(null);
          }
        }),
        h('div', { className: 'aicd-btn-row' },
          h('button', { type: 'button', className: 'aicd-btn', 'data-variant': 'primary', onClick: save }, tr('noteSave')),
          h('span', { className: 'aicd-count' }, `${length} / 4000`)
        ),
        h('details', { className: 'aicd-fold' },
          h('summary', { className: 'aicd-fold-head' }, tr('noteInjected')),
          h('pre', { className: 'aicd-injected' }, injected.length === 0 ? '—' : injected),
          h('p', { className: 'aicd-note' }, tr('noteHint'))),
        status === 'saved' ? h('p', { className: 'aicd-note', 'data-tone': 'ok' }, tr('noteSaved')) : null,
        status === 'too-long' ? h('p', { className: 'aicd-note', 'data-tone': 'bad' }, tr('noteTooLong')) : null,
        status === 'failed' ? h('p', { className: 'aicd-note', 'data-tone': 'bad' }, tr('noteFailed')) : null,
        status === 'empty' ? h('p', { className: 'aicd-note' }, tr('noteEmpty')) : null
      );
    }

    /**
     * The four numbers a bug report needs, kept in one fold at the bottom of
     * Settings. It reports only what this install can verify: the server side
     * answers the runtime facts, the client adds which surface is on screen.
     * No token, no home directory, no conversation titles — it is meant to be
     * copied into a public issue.
     */
    function Diagnostics({ surface }) {
      const [data, setData] = useState(null);
      const [failed, setFailed] = useState(null);
      const [copied, setCopied] = useState(false);

      useEffect(() => {
        fetch('/aiignore/diagnostics', { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => setData(payload))
          .catch((reason) => setFailed(reason === undefined || reason === null ? new Error('unknown') : reason));
      }, []);

      const rows = data === null
        ? []
        : [
            [tr('diagPlugin'), data.plugin === null ? '—' : data.plugin],
            [tr('diagNode'), data.node || '—'],
            [tr('diagPlatform'), data.platform || '—'],
            [tr('diagHome'), data.home || '—'],
            [tr('diagWorkspace'), data.workspace === null ? tr('diagNone') : data.workspace],
            [tr('diagSessions'), String(data.sessions === undefined ? '—' : data.sessions)],
            [tr('diagRules'), String(data.rules === undefined ? '—' : data.rules)],
            [tr('diagSurface'), surface === 'sidebar' ? tr('diagSidebar') : tr('diagOverlay')]
          ];

      const copy = () => {
        const text = rows.map(([name, value]) => `${name}: ${value}`).join('\n');
        const done = () => setCopied(true);
        if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(text).then(done, () => setCopied(false));
          return;
        }
        // Older webviews have no clipboard API; the text is on screen anyway.
        setCopied(false);
      };

      return h('details', { className: 'aicd-fold aicd-diag' },
        h('summary', { className: 'aicd-fold-head' }, tr('diagTitle')),
        failed !== null
          ? h('div', { className: 'aicd-state-inline', 'data-tone': 'bad' },
              h(Icon, { name: 'warn', size: 12 }),
              h('span', null, `${tr('diagFailed')} · ${tr('errorStatus')} ${reasonOf(failed)}`))
          : data === null
            ? h('div', { className: 'aicd-diag-loading' }, tr('diagLoading'))
            : h('dl', { className: 'aicd-kv aicd-diag-rows' },
                rows.flatMap(([name, value]) => [
                  h('dt', { key: `${name}-k` }, name),
                  h('dd', { key: `${name}-v`, className: 'aicd-diag-value', title: value }, value)
                ])),
        h('div', { className: 'aicd-btn-row' },
          h('button', {
            type: 'button',
            className: 'aicd-textbtn',
            disabled: data === null,
            onClick: copy
          }, copied === true ? tr('diagCopied') : tr('diagCopy')))
      );
    }

    function SettingsView({ data, conv, onDone, onRescan, onProtect, surface }) {
      const scanned = data.scanned || {};
      const effective = typeof scanned.effectiveScore === 'number' ? scanned.effectiveScore : null;
      const raw = typeof scanned.healthScore === 'number' ? scanned.healthScore : null;

      return h('div', { className: 'aicd-body' },
        h('div', { className: 'aicd-opt aicd-opt-row' },
          h('span', { className: 'aicd-opt-title' }, tr('strategyTitle')),
          h('span', { className: 'aicd-count' }, `${typeof data.level === 'number' ? data.level : 3} / 5`),
          h('button', { type: 'button', className: 'aicd-textbtn', onClick: onProtect }, tr('strengthMovedGo'))
        ),
        h(RulesCard, { data, onDone }),
        h(NoteView, { data, onSaved: onDone }),
        h('div', { className: 'aicd-section' },
          h('div', { className: 'aicd-section-title' }, tr('scoreTitle')),
          h('div', { className: 'aicd-note' },
            `${tr('scoreOnDisk')} ${raw === null ? '—' : raw} · ${tr('scoreFolder')} ${effective === null ? '—' : effective}`),
          h(ScoreBreakdown, {
            rows: scanned.effectiveBreakdown,
            lost: scanned.effectiveLost,
            title: tr('scoreHow'),
            formula: tr('scoreFormula')
          })
        ),
        h(Diagnostics, { surface: surface })
      );
    }

    //#endregion score

    //#region chat

    /**
     * The panel's first tab: one conversation, not one folder. Its title, what it
     * spent tokens on, which files it read, and one button that turns those reads
     * into `.aiignore` rules — with the before/after score right there.
     */
    /**
     * The first screen: one number that grows because the plugin is working.
     *
     * A score describes a folder and stops moving once the rules cover it —
     * that is why it never felt like anything happened. This counts the reads
     * the guard refused, which only goes up when there was something to refuse.
     */
    /**
     * The ladder, where the number is.
     *
     * Choosing a notch used to mean leaving the conversation, changing a
     * setting on another tab, coming back and pressing refresh — four steps to
     * answer "what would one notch stricter do to this conversation". The five
     * notches and the score each one would leave now sit directly under the
     * score they change, and picking one applies it and rescores the same page.
     */
    function StrengthStrip({ data, level, busy, onPick, head }) {
      const cwd = data !== null && data !== undefined && typeof data.workspace === 'string' ? data.workspace : '';
      const { levels, failed, retry } = useLevels(cwd);

      if (failed !== null) {
        return h('div', { className: 'aicd-strength-state' },
          h(State, {
            kind: 'error',
            errorTitle: tr('strengthFailedTitle'),
            hint: tr('strengthFailed'),
            error: failed,
            onRetry: retry
          })
        );
      }
      if (levels === null) return h(State, { kind: 'loading', rows: 1 });
      if (levels.length === 0) return null;

      const current = levels.find((row) => row.level === level);

      return h('div', { className: 'aicd-strength' },
        head === false
          ? h('div', { className: 'aicd-strength-head aicd-strength-head-plain' },
              h('span', { className: 'aicd-strength-now' }, current === undefined ? '' : current.label))
          : h('div', { className: 'aicd-strength-head' },
              h('span', { className: 'aicd-list-title' }, tr('strengthTitle')),
              h('span', { className: 'aicd-strength-now' }, current === undefined ? '' : current.label)
            ),
        h('div', {
          className: 'aicd-strength-row',
          role: 'group',
          'aria-label': tr('strengthTitle')
        },
          levels.map((row) =>
            h('button', {
              key: row.level,
              type: 'button',
              className: 'aicd-strength-cell',
              'data-active': row.level === level ? 'true' : 'false',
              'aria-pressed': row.level === level ? 'true' : 'false',
              disabled: busy === true,
              title: row.note,
              onClick: () => onPick(row.level)
            },
              h('span', { className: 'aicd-strength-num' }, String(row.level)),
              h('span', { className: 'aicd-strength-score' },
                typeof row.effectiveScore === 'number' ? String(row.effectiveScore) : '—')
            )
          )
        ),
        h('div', { className: 'aicd-strength-hint' }, tr('strengthHintShort'))
      );
    }

    // The three things Optimize actually does, in the order the Host does them.
    // A bar with invented percentages would claim progress the Host has not
    // made; these steps are marked done only once their request has returned.
    const PHASES = ['Scan', 'Write'];

    function ProtectView({ data, conv, convError, progress, optimize, onAllow, onIgnore, onSettings, level, levelBusy, onLevel }) {
      const skipped = Array.isArray(data.skipped) ? data.skipped.filter((item) => item.attempts > 0) : [];
      const potential = data.potential !== null && typeof data.potential === 'object' ? data.potential : null;
      const rules = Array.isArray(data.rules) ? data.rules : [];
      const conversation = conv !== null && conv !== undefined && typeof conv.turns === 'number' ? conv : null;
      const [raised, setRaised] = useState(null);

      /**
       * The counter is about this conversation, so it has to move when the
       * conversation's own rules change. `covered` is what the rules hold back
       * now; `noiseCount` is how many of its reads are noise at all, so the gap
       * between the two is exactly what Optimize has left to do.
       */
      const keptOut = conversation !== null && typeof conversation.coveredCount === 'number'
        ? conversation.coveredCount
        : (conversation !== null && Array.isArray(conversation.covered) ? conversation.covered.length : 0);
      const noiseReads = conversation !== null && typeof conversation.noiseCount === 'number' ? conversation.noiseCount : keptOut;
      const pendingReads = Math.max(0, noiseReads - keptOut);
      const keptOutTokens = conversation !== null && conversation.coveredTokens !== undefined ? conversation.coveredTokens : null;

      /**
       * The first number is a score, not a counter.
       *
       * On a first open nothing has been applied, so the page shows the folder
       * as it is and one button. Pressing it writes the rules and the same card
       * comes back with the new score and what it moved from — the interaction
       * is the point, and a counter that only ever said "0 reads held back"
       * pre-empted it.
       */
      const scored = data.scanned !== null && typeof data.scanned === 'object' ? data.scanned : {};
      const firstScore = typeof scored.healthScore === 'number' ? scored.healthScore : null;
      // "Applied" means rules exist, not that two numbers differ: the level
      // alone can move the effective score, and a first open with no rules must
      // still show the folder as it is — otherwise the interaction it invites
      // (press, watch the number move) has already happened without the user.
      // One number, always the current one: the folder scored with the rules and
      // the strength in force right now. Switching between "before" and "after"
      // depending on whether a folder happens to have rules made two folders
      // answer the same question with different kinds of number.
      // The card sits under one conversation's title and lists that
      // conversation's turns and files, so its number has to be that
      // conversation's — the same number the overview row shows. The folder
      // score is a different question and lives in Settings ("On disk 22 ·
      // Reaches the model 71"). Showing the folder number here made the same
      // conversation read 74 in the list and 71 on the card.
      const conversationScore = conversation !== null && typeof conversation.effectiveScore === 'number'
        ? conversation.effectiveScore
        : null;
      const shownScore = conversationScore !== null
        ? conversationScore
        : typeof scored.effectiveScore === 'number' ? scored.effectiveScore : firstScore;
      const applied = shownScore !== null;
      // No score is not the score zero: a folder nobody has scanned yet has no
      // number to show, and a dash under "Score before rules" reads as a broken
      // scoreboard rather than as an invitation to press the button.
      const unscored = shownScore === null;
      const quiet = keptOut === 0 && pendingReads === 0;
      const subline = unscored === true
        ? tr('scoreUnknownHint')
        : keptOut > 0
        ? `${keptOut} ${tr(keptOut === 1 ? 'heroOne' : 'heroMany')}${
            keptOutTokens === null ? '' : ` · ${formatTokensCompact(keptOutTokens)} ${tr('heroKept')}`
          }`
        : pendingReads > 0
          // Rules can be in effect and still not cover what this conversation
          // read; saying "nothing applied yet" next to "2 rules in effect" is
          // the panel contradicting itself on one screen.
          ? rules.length > 0
            ? fill(tr('scorePendingUnderRules'), { reads: pendingReads })
            : tr('scoreBeforeHint')
          // A conversation that could not be read must not be described as one
          // that read nothing: quiet is a fact about a conversation we have.
          : quiet === true && conversation !== null
            ? (() => {
                const files = conversation.readFiles;
                const tokens = formatTokensCompact(conversation.tokens);
                return fill(tr(tokens === '—' ? 'heroQuietLineShort' : 'heroQuietLine'), { files, tokens });
              })()
            : tr('scoreBeforeHint');

      const applyNext = () => {
        if (potential === null || raised !== null) return;
        setRaised('busy');
        fetch('/aiignore/policy', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ level: potential.level })
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then(() => {
            setRaised('done');
            optimize();
          })
          .catch(() => setRaised('failed'));
      };

      const row = (item) => h('div', { key: item.path, className: 'aicd-item' },
        h('span', { className: 'aicd-item-icon' }, h(Icon, { name: 'warn', size: 12 })),
        h('div', { className: 'aicd-item-main' },
          h('span', { className: 'aicd-item-name', title: item.path }, item.path),
          h('span', { className: 'aicd-item-meta' },
            `${formatBytes(item.bytes)} · ${item.reason}${item.attempts > 1 ? ` · ${item.attempts}×` : ''}`)
        ),
        h('div', { className: 'aicd-item-actions' },
          h('button', {
            type: 'button',
            className: 'aicd-minibtn',
            title: tr('readOnce'),
            'aria-label': tr('readOnce'),
            onClick: () => onAllow(item.path)
          }, h(Icon, { name: 'check', size: 12 })),
          h('button', {
            type: 'button',
            className: 'aicd-minibtn',
            title: tr('neverRead'),
            'aria-label': tr('neverRead'),
            onClick: () => onIgnore(item.path)
          }, h(Icon, { name: 'lock', size: 12 }))
        )
      );

      return h('div', { className: 'aicd-body aicd-protect' },
        h('div', { className: 'aicd-stat' },
          unscored === true
            ? h('div', { className: 'aicd-stat-label aicd-stat-lead' }, tr('scoreUnknownLabel'))
            : h('div', { className: 'aicd-stat-top' },
              h('div', {
                className: 'aicd-stat-num',
                'data-tone': applied === true ? 'good' : undefined
              }, String(shownScore)),
              h('div', { className: 'aicd-stat-label' }, tr('scoreCurrentLabel'))
            ),
          h('div', { className: 'aicd-stat-sub' }, subline),
          h('button', {
            type: 'button',
            className: 'aicd-btn',
            'data-variant': 'primary',
            'data-wide': 'true',
            disabled: progress !== null,
            onClick: optimize
          }, progress === null ? tr('optimizeNow') : tr('working')),
          progress === null ? null : h('ol', { className: 'aicd-steps', 'aria-live': 'polite' },
            PHASES.map((phase) => {
              const done = PHASES.indexOf(phase) < PHASES.indexOf(progress);
              const active = phase === progress;
              return h('li', {
                key: phase,
                className: 'aicd-step',
                'data-state': done === true ? 'done' : active === true ? 'active' : 'todo'
              },
              h('span', { className: 'aicd-step-mark', 'aria-hidden': 'true' }, done === true ? '✓' : ''),
              h('span', { className: 'aicd-step-label' }, tr(`phase${phase}`)))
            })
          ),
          conversation === null ? null : h('div', { className: 'aicd-stat-meta' },
            `${conversation.turns} ${tr('turns')} · ${conversation.readFiles} ${tr('files')} · ${shortTokens(tokenTotal(conversation.tokens))} ${tr('tokens')}`),
          // A conversation that could not be read is a fact the page owes the
          // reader: the counter above is about this conversation, so a failed
          // read must not look like a conversation that read nothing.
          convError === null || convError === undefined
            ? null
            : h('div', { className: 'aicd-state-inline', 'data-tone': 'bad' },
                h(Icon, { name: 'warn', size: 12 }),
                h('span', null, `${tr('chatUnavailable')} · ${tr('errorStatus')} ${reasonOf(convError)}`))
        ),

        h('details', { className: 'aicd-fold aicd-strength-fold' },
          h('summary', { className: 'aicd-fold-head' }, tr('strengthFold')),
          h(StrengthStrip, { data, level, busy: levelBusy, onPick: onLevel, head: false })
        ),

        potential === null ? null : h('div', { className: 'aicd-hint' },
          h('span', { className: 'aicd-hint-text' },
            `${tr('nextStep')} ${potential.extraFiles} ${tr('nextFiles')} · ${shortTokens(potential.extraTokens)} ${tr('tokens')}`),
          h('button', {
            type: 'button',
            className: 'aicd-textbtn',
            disabled: raised === 'busy',
            onClick: applyNext
          }, raised === 'done' ? tr('nextDone') : tr('applyNext'))
        ),

        h('div', { className: 'aicd-list' },
          h('div', { className: 'aicd-list-head' },
            h('span', { className: 'aicd-list-title' }, tr('blockedTitle')),
            h('span', { className: 'aicd-list-count' }, String(skipped.length))
          ),
          skipped.length === 0
            ? h('div', { className: 'aicd-list-empty' }, tr('blockedNone'))
            : skipped.map(row)
        ),

        h('div', { className: 'aicd-foot' },
          h('span', null, `${rules.length} ${tr('rulesOn')}`),
          h('button', { type: 'button', className: 'aicd-textbtn', onClick: onSettings }, tr('openSettings'))
        )
      );
    }

    //#endregion chat

    //#region summary

    /**
     * The left sidebar's own page: every conversation this app has run, side by
     * side. The panel answers "this conversation"; this answers "all of them" —
     * which one read the most, which one read the most noise, and which one is
     * worth fixing first.
     */
    function SummaryPage(props) {
      const [data, setData] = useState(null);
      const [failed, setFailed] = useState(null);
      const [busy, setBusy] = useState(null);
      const [notice, setNotice] = useState(null);
      const holder = props === null || props === undefined ? {} : props;
      const openPanel = typeof holder.openPanel === 'function' ? holder.openPanel : null;

      const load = (fresh) => {
        setFailed(null);
        const suffix = fresh === true ? '?fresh=1' : '';
        fetch(`/aiignore/conversations${suffix}`, { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => setData(Array.isArray(payload.conversations) ? payload : { conversations: [], current: null }))
          .catch((reason) => setFailed(reason === undefined || reason === null ? new Error('unknown') : reason))
          .then(() => setBusy(null));
      };
      useEffect(() => load(false), []);

      const apply = (row) => {
        setBusy(row.id);
        setNotice(null);
        fetch('/aiignore/optimize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session: row.id })
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setNotice(`${tr('scoreMoved')} ${payload.before} → ${payload.after}${payload.added !== undefined && payload.added.length > 0 ? ` · ${payload.added.join(', ')}` : ''}`);
            load(true);
          })
          .catch(() => {
            setBusy(null);
            setNotice(tr('optimizeFailed'));
          });
      };

      const shown = (row) => (typeof row.effectiveScore === 'number' ? row.effectiveScore : row.score);

      const rows = data === null
        ? []
        : data.conversations.slice().sort((left, right) => (left.score ?? 101) - (right.score ?? 101));
      const totalFiles = rows.reduce((sum, row) => sum + (typeof row.readFiles === 'number' ? row.readFiles : 0), 0);
      const totalBytes = rows.reduce((sum, row) => sum + (typeof row.readBytes === 'number' ? row.readBytes : 0), 0);

      return h('div', { className: 'aicd-page' },
        h('div', { className: 'aicd-page-inner' },
          h('div', { className: 'aicd-page-head' },
            h('div', null,
              h('h1', { className: 'aicd-page-title' }, tr('overviewTitle')),
              h('p', { className: 'aicd-page-hint' }, tr('overviewHint'))
            ),
            h('div', { className: 'aicd-btn-row' },
              h('button', { type: 'button', className: 'aicd-btn', disabled: busy !== null ? 'true' : undefined, onClick: () => { setBusy('all'); load(true); } }, tr('rescan')),
              openPanel === null
                ? null
                : h('button', { type: 'button', className: 'aicd-btn', 'data-variant': 'primary', onClick: () => openPanel() }, tr('overviewOpen'))
            )
          ),
          failed !== null
            ? h(State, { kind: 'error', errorTitle: tr('overviewFailedTitle'), hint: tr('overviewFailed'), error: failed, onRetry: () => load(true) })
            : null,
          notice !== null ? h('p', { className: 'aicd-note' }, notice) : null,
          failed === null && rows.length > 0
            ? h('p', { className: 'aicd-page-hint' },
                `${rows.length} ${tr('overviewConversations')} · ${totalFiles} ${tr('files')} · ${formatBytes(totalBytes)}`)
            : null,
          failed !== null
            ? null
            : data === null
              ? h(State, { kind: 'loading', rows: 3 })
              : rows.length === 0
                ? h(State, { kind: 'empty', icon: 'spark', title: tr('overviewNone'), hint: tr('overviewNoneHint') })
                : null,
          rows.map((row) =>
            h('div', { key: row.id, className: 'aicd-page-row' },
              h('span', {
                className: 'aicd-page-score',
                'data-tone': typeof shown(row) === 'number' ? toneFor(shown(row)) : 'bad'
              }, typeof shown(row) === 'number' ? String(shown(row)) : '—'),
              h('span', { className: 'aicd-page-text' },
                h('span', { className: 'aicd-page-name' },
                  row.title,
                  row.id === (data === null ? null : data.current)
                    ? h('span', { className: 'aicd-page-badge' }, tr('chatCurrent'))
                    : null,
                  row.covered > 0
                    ? h('span', { className: 'aicd-count' }, `${row.covered} ${tr('coveredBadge')}`)
                    : null
                ),
                h('span', { className: 'aicd-page-meta' },
                  `${shortPath(row.cwd)} · ${row.turns} ${tr('chatTurns')} · ${row.readFiles} ${tr('files')} · ${formatBytes(row.readBytes)}`
                    + (row.noise > 0 ? ` · ${row.noise} ${tr('noise')}` : '')
                    + (typeof row.effectiveScore === 'number' && row.effectiveScore !== row.score
                      ? ` · ${row.score} ${tr('beforeRules')}`
                      : '')
                )
              ),
              h('span', { className: 'aicd-page-actions' },
                row.noise > 0
                  ? h('button', {
                      type: 'button',
                      className: 'aicd-btn',
                      'data-variant': 'primary',
                      disabled: busy !== null ? 'true' : undefined,
                      title: row.cwd,
                      onClick: () => apply(row)
                    }, `${tr('overviewApply')} ${row.noise}`)
                  : h('span', { className: 'aicd-count' }, '—')
              )
            )
          )
        )
      );
    }

    //#endregion summary

    /**
     * No workspace: offer the folders this app has been used in, and the Scan
     * button for the conversation's own directory. A dead end is a bug.
     */
    function NoWorkspace({ spaces, pending, scan, pick, scanError, choosing }) {
      const knows = spaces !== null && spaces.length > 0;
      return h('div', { className: 'aicd-body', 'data-center': 'true' },
        h(Empty, {
          icon: 'spark',
          title: choosing === true ? tr('chooseFolder') : tr('emptyTitle'),
          hint: knows ? tr('pickHint') : tr('emptyHint'),
          action: h('div', null,
            knows
              ? h('div', { className: 'aicd-pick' },
                  spaces.slice(0, 6).map((space) =>
                    h('button', {
                      key: space.path,
                      type: 'button',
                      className: 'aicd-pick-row',
                      title: space.path,
                      disabled: pending === 'pick' ? 'true' : undefined,
                      onClick: () => pick(space.path)
                    },
                      h('span', { className: 'aicd-pick-name' }, space.title),
                      h('span', { className: 'aicd-pick-meta' }, `${space.sessions} ${tr('pickSessions')}`)
                    )
                  )
                )
              : null,
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
      );
    }

    /**
     * The two facts the panel learns on its own: what the Host handed this body
     * (reported once, so a future mismatch is one GET away), and the folders this
     * app has been used in, which it offers when it has no workspace.
     */
    function useClientFacts(props, cwd, data, error, want) {
      const [spaces, setSpaces] = useState(null);

      useEffect(() => {
        const holder = props === null || props === undefined ? {} : props;
        fetch('/aiignore/client-report', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            keys: Object.keys(holder),
            sessionId: typeof holder.sessionId === 'string' ? holder.sessionId : null,
            hasUseSessions: typeof holder.useSessions === 'function',
            cwd: cwd === undefined ? null : cwd
          })
        }).catch(() => {});
      }, []);

      const missing = data !== null && error === null && (data.workspace === null || data.workspace === undefined);
      useEffect(() => {
        if ((missing !== true && want !== true) || spaces !== null) return;
        fetch('/aiignore/workspaces', { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => setSpaces(Array.isArray(payload.workspaces) ? payload.workspaces : []))
          .catch(() => setSpaces([]));
      }, [missing, want, spaces]);

      return spaces;
    }

    /** The panel header: where you are, whether it follows the conversation, and the few actions. */
    function PanelHead({ data, conv, pinned, menu, setMenu, follow, choose, setPinned, rescan, view, setView, tabs, toast, rescanning, pinnedSession, onFollowConversation }) {
      const workspace = data === null ? null : data.workspace;
      const known = workspace !== null && workspace !== undefined;
      const following = known && pinned === null;
      // The title answers "which conversation is this", the path answers
      // "which folder" — a truncated path alone never told anyone the first.
      const conversationTitle = conv !== null && conv !== undefined && typeof conv.title === 'string' && conv.title.trim().length > 0
        ? conv.title.trim()
        : null;
      const heading = conversationTitle !== null
        ? conversationTitle
        : (known ? shortPath(workspace) : tr('tabTitle'));

      // A dropdown is only real chrome if it closes the way every menu does:
      // Escape anywhere in it, a click outside it — and focus moves in when it
      // opens and back to the button that opened it when it closes.
      const menuBtnRef = useRef(null);
      const closeMenu = useCallback(() => {
        setMenu(false);
        const button = menuBtnRef.current;
        if (button !== null && button !== undefined && typeof button.focus === 'function') button.focus();
      }, [setMenu]);
      useEffect(() => {
        if (menu !== true) return undefined;
        const first = document.querySelector('.aicd-menu-item:not([aria-disabled="true"])');
        if (first !== null && first !== undefined && typeof first.focus === 'function') first.focus();
        const onDocDown = (event) => {
          const target = event.target;
          if (target !== null && target !== undefined && typeof target.closest === 'function'
            && target.closest('.aicd-menu') !== null) return;
          if (target !== null && target !== undefined && typeof target.closest === 'function'
            && menuBtnRef.current !== null && menuBtnRef.current !== undefined
            && target.closest('[data-aicd-menu-btn]') !== null) return;
          setMenu(false);
        };
        document.addEventListener('mousedown', onDocDown);
        return () => document.removeEventListener('mousedown', onDocDown);
      }, [menu === true, setMenu, closeMenu]);
      const onMenuKey = (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          closeMenu();
          return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const items = Array.prototype.slice.call(
          (event.currentTarget !== null && event.currentTarget !== undefined
            ? event.currentTarget.querySelectorAll('.aicd-menu-item:not([aria-disabled="true"])')
            : [])
        );
        if (items.length === 0) return;
        const at = items.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown'
          ? items[(at + items.length + 1) % items.length]
          : items[(at + items.length - 1) % items.length];
        if (next !== null && next !== undefined && typeof next.focus === 'function') next.focus();
        event.preventDefault();
      };

      return (
        h('div', { className: 'aicd-head' },
          h('div', { className: 'aicd-head-row' },
            h('span', { className: 'aicd-head-title', title: heading }, heading),
            h('div', { className: 'aicd-head-tools' },
              h('button', {
                type: 'button',
                className: 'aicd-iconbtn',
                title: tr('rescanHint'),
                'aria-label': tr('rescanHint'),
                'data-busy': rescanning === true ? 'true' : 'false',
                disabled: rescanning === true ? 'true' : undefined,
                onClick: rescan
              }, h(Icon, { name: 'refresh', size: 13 })),
              h('button', {
                type: 'button',
                ref: menuBtnRef,
                className: 'aicd-iconbtn',
                title: tr('chooseFolder'),
                'aria-label': tr('chooseFolder'),
                'aria-expanded': menu === true ? 'true' : 'false',
                'aria-haspopup': 'menu',
                'data-aicd-menu-btn': 'true',
                onKeyDown: (event) => {
                  if (menu !== true && event.key === 'Escape') {
                    event.stopPropagation();
                    setMenu(false);
                    return;
                  }
                  if (menu !== true && event.key === 'ArrowDown') {
                    event.preventDefault();
                    setMenu(true);
                  }
                },
                onClick: () => setMenu(menu !== true)
              }, h(Icon, { name: 'folder', size: 13 }))
            ),
            menu === true
              ? h('div', { className: 'aicd-menu', role: 'menu', onKeyDown: onMenuKey },
                  h('button', {
                    type: 'button',
                    role: 'menuitem',
                    className: 'aicd-menu-item',
                    'aria-disabled': following ? 'true' : undefined,
                    onClick: follow
                  }, tr('follow')),
                  h('button', {
                    type: 'button',
                    role: 'menuitem',
                    className: 'aicd-menu-item',
                    onClick: choose
                  }, tr('chooseFolder')),
                  pinned === null
                    ? null
                    : h('button', {
                        type: 'button',
                        role: 'menuitem',
                        className: 'aicd-menu-item',
                        onClick: () => { setPinned(null); setMenu(false); }
                      }, tr('clearChoice'))
                )
              : null
          ),
          h('div', { className: 'aicd-head-sub' },
            known
              ? h('span', { className: 'aicd-path', title: workspace }, shortPath(workspace))
              : h('span', { className: 'aicd-path' }, tr('emptyTitle')),
            following ? h('span', { className: 'aicd-chipdot' }, tr('followOn')) : null,
            pinnedSession === null || pinnedSession === undefined
              ? null
              : h('button', {
                  type: 'button',
                  className: 'aicd-chipdot',
                  'data-state': 'pinned',
                  title: tr('chatFollowBack'),
                  onClick: onFollowConversation
                }, tr('chatPinned'))
          ),
          toast === null || toast === undefined
            ? null
            : h('div', { className: 'aicd-toast', role: 'status' }, toast),
          data === null
            ? null
            : h('div', {
                className: 'aicd-tabs',
                role: 'tablist',
                // A tablist that can only be driven by clicks is unreachable
                // from the keyboard once focus has moved past it: arrows move
                // between tabs the way the platform expects.
                onKeyDown: (event) => {
                  const ids = tabs.map(([id]) => id);
                  const at = ids.indexOf(view);
                  let next = null;
                  if (event.key === 'ArrowRight') next = ids[(at + 1) % ids.length];
                  else if (event.key === 'ArrowLeft') next = ids[(at - 1 + ids.length) % ids.length];
                  else if (event.key === 'Home') next = ids[0];
                  else if (event.key === 'End') next = ids[ids.length - 1];
                  if (next === null || next === undefined) return;
                  event.preventDefault();
                  setView(next);
                  const el = document.getElementById(`aicd-tab-${next}`);
                  if (el !== null && typeof el.focus === 'function') el.focus();
                }
              },
              tabs.map(([id, label]) =>
                h('button', {
                  key: id,
                  type: 'button',
                  role: 'tab',
                  id: `aicd-tab-${id}`,
                  className: 'aicd-tab',
                  'aria-selected': view === id ? 'true' : 'false',
                  'aria-controls': `aicd-view-${id}`,
                  // Roving tabindex: one stop for the whole tablist.
                  tabIndex: view === id ? 0 : -1,
                  onClick: () => setView(id)
                }, label)
              )
            )
        )
      );
    }

    /** The panel: one header, three views, one report. */

    //#region shell
    function Panel(props) {
      // Which folder this panel audits. null means "follow the conversation":
      // the Host half reads that from the session store. Pinning one here is
      // always undoable — a choice you cannot leave is not a choice.
      const [pinned, setPinned] = useState(null);
      const [menu, setMenu] = useState(false);
      const [choosing, setChoosing] = useState(false);
      const cwd = pinned === null ? sessionCwd(props) : pinned;
      const { data, error, at, setAt, tree, reload, reloadTree, applyReport } = useReport(cwd);
      const spaces = useClientFacts(props, cwd, data, error, choosing);

      const pick = (dir) => {
        setPending('pick');
        setScanError(false);
        fetch(`/aiignore/scan?cwd=${encodeURIComponent(dir)}`, { method: 'POST', headers: { 'content-type': 'application/json' } })
          .then((response) => response.json())
          .then((payload) => {
            if (payload === null || typeof payload !== 'object' || payload.workspace === undefined || payload.workspace === null) {
              setScanError(true);
              return;
            }
            setPinned(dir);
            setChoosing(false);
            reload();
            reloadTree();
          })
          .catch(() => setScanError(true))
          .finally(() => setPending(null));
      };

      const choose = () => {
        setChoosing(true);
        setMenu(false);
      };

      const follow = () => {
        setPinned(null);
        setChoosing(false);
        setMenu(false);
        reload();
        reloadTree();
      };
      // Which conversation the Chat tab looks at. null follows the open one.
      const [pinnedSession, setPinnedSession] = useState(null);
      // Bumped whenever an action changes what the conversation's rules cover.
      const [convNonce, setConvNonce] = useState(0);
      const refreshConversation = useCallback(() => setConvNonce((value) => value + 1), []);
      // The slot is rendered per conversation, so its id is the one fact that
      // says which conversation is in front of the user. Pinning another one is
      // a deliberate act; following is the default and must be exact.
      const liveSession = typeof props.sessionId === 'string' && props.sessionId.length > 0 ? props.sessionId : null;
      const shownSession = pinnedSession !== null ? pinnedSession : liveSession;
      const { conv, error: convError } = useConversation(shownSession, convNonce);
      const [view, setView] = useState('protect');
      const [pending, setPending] = useState(null);
      const [postError, setPostError] = useState(null);
      const [lastIgnored, setLastIgnored] = useState(null);

      const post = (route, target, done, rule) => {
        setPending(target);
        setPostError(null);
        fetch(route, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(rule === undefined || rule === null ? { path: target } : { path: target, rule })
        })
          .then((response) => response.json())
          .then((payload) => {
            // The score is computed from the last scan plus the rules in force.
            // Writing a rule without re-scoring would leave the number on screen
            // describing rules that no longer exist.
            if (done(payload)) rescan();
            else setPostError('refused');
          })
          .catch(() => setPostError('failed'))
          .finally(() => setPending(null));
      };

      const [scanError, setScanError] = useState(false);
      const [toast, setToast] = useState(null);

      // A toast is a receipt, not a notice board: it clears itself, so one
      // failed click cannot look like a permanent state of the panel.
      useEffect(() => {
        if (toast === null || toast === undefined) return undefined;
        const timer = setTimeout(() => setToast(null), 7000);
        return () => clearTimeout(timer);
      }, [toast]);
      const scan = () => {
        setPending('scan');
        setScanError(false);
        const target = typeof cwd === 'string' && cwd.length > 0 ? `/aiignore/scan?cwd=${encodeURIComponent(cwd)}` : '/aiignore/scan';
        fetch(target, { method: 'POST', headers: { 'content-type': 'application/json' } })
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
      const onIgnore = (target, after, rule) => post('/aiignore/ignore', target, (payload) => {
        const ok = payload.ignored === true;
        if (ok) {
          // Keep the rule we just wrote, so the panel can take it back out.
          setLastIgnored(payload.rule || target);
          if (after !== undefined) after();
        }
        return ok;
      }, rule);
      /**
       * Write a suggested rule. Unlike `onIgnore` there is no file to name,
       * so this goes to its own route; the reload afterwards is what makes the
       * suggestion disappear and the score move.
       */
      const onAddRule = (rule) => {
        setPending(rule);
        setPostError(null);
        fetch('/aiignore/rules', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rule })
        })
          .then((response) => response.json())
          .then((payload) => {
            if (payload !== null && payload !== undefined && payload.rule !== undefined) {
              setToast(`${tr('ruleAdded')} ${payload.rule}`);
              reload();
              reloadTree();
            } else {
              setPostError('refused');
            }
          })
          .catch(() => setPostError('failed'))
          .finally(() => setPending(null));
      };
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
        ['protect', tr('tabProtect')],
        ['files', tr('tabFiles')],
        ['settings', tr('tabSettings')]
      ];

      // Refresh has to mean something: re-read the folder *and* the conversation,
      // so the numbers on screen are read again rather than redrawn.
      const rescan = () => {
        const target = typeof cwd === 'string' && cwd.length > 0 ? `/aiignore/scan?cwd=${encodeURIComponent(cwd)}` : '/aiignore/scan';
        setToast(tr('scanning'));
        fetch(target, { method: 'POST', headers: { 'content-type': 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            const fresh = payload !== null && payload !== undefined && payload.scanned !== undefined ? payload : null;
            if (fresh !== null) {
              reload();
              reloadTree();
              refreshConversation();
              setToast(`${tr('scanned')} ${fresh.scanned.files} ${tr('files')} · ${tr('scoreFolder')} ${fresh.scanned.effectiveScore}`);
            } else {
              setToast(tr('scanFailed'));
            }
          })
          .catch(() => setToast(tr('scanFailed')));
      };

      // One button, three real steps. Each phase is only announced once the
      // request behind it has come back, so the bar cannot claim progress the
      // Host has not made.
      const [progress, setProgress] = useState(null);
      const optimizeNow = () => {
        if (progress !== null) return;
        const body = typeof cwd === 'string' && cwd.length > 0
          ? { cwd }
          : (conv !== null && conv !== undefined && typeof conv.id === 'string' ? { session: conv.id } : {});
        setToast(null);
        // No warm-up scan: `/aiignore/optimize` already reads the folder before
        // and after writing, so a second scan here would only double the wait.
        setProgress('Scan');

        fetch('/aiignore/optimize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setProgress('Write');
            if (payload !== null && payload !== undefined && payload.report !== undefined) {
              applyReport(payload.report);
            }
            const added = Array.isArray(payload === null || payload === undefined ? undefined : payload.added) ? payload.added.length : 0;
            setToast(added === 0
              ? tr('optimizeNothing')
              : `${tr('scoreMoved')} ${payload.before} → ${payload.after} · ${added} ${tr('rules')}`);
            reload();
            reloadTree();
            refreshConversation();
            return null;
          })
          .catch((error) => setToast(`${tr('optimizeFailed')} ${errorMessage(error)}`))
          .finally(() => setProgress(null));
      };

      // Applying a notch is a write and a re-read: the policy lands first, then
      // the same folder is scanned again, so the score on screen is the score
      // that notch produced rather than a number we assumed it would produce.
      const [levelBusy, setLevelBusy] = useState(false);
      const level = data !== null && data !== undefined && typeof data.level === 'number' ? data.level : 3;
      const pickLevel = (next) => {
        if (levelBusy === true || next === level) return;
        setLevelBusy(true);
        setToast(null);
        fetch('/aiignore/policy', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ level: next })
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then(() => {
            rescan();
          })
          .catch((error) => setToast(`${tr('optimizeFailed')} ${errorMessage(error)}`))
          .finally(() => setLevelBusy(false));
      };

      const onOptimized = (payload) => {
        if (payload !== null && payload !== undefined && payload.report !== undefined) {
          applyReport(payload.report);
          reloadTree();
          refreshConversation();
          setToast(`${tr('scoreMoved')} ${payload.before} → ${payload.after}`);
        } else {
          reload();
        }
      };

      return h('div', { className: 'aicd-panel' },
        h(PanelHead, {
          data, pinned, menu, setMenu, follow, setChoosing, setPinned, rescan, conv,
          view, setView, tabs, choose, toast, rescanning: pending === 'scan',
          pinnedSession, onFollowConversation: () => setPinnedSession(null)
        }),
        h('div', {
          className: 'aicd-view',
          role: 'tabpanel',
          id: `aicd-view-${view}`,
          'aria-labelledby': `aicd-tab-${view}`,
          // Named by the tab that opened it, and focusable so a keyboard user
          // can reach the content without tabbing through every row first.
          tabIndex: -1
        },
        error !== null
          ? h('div', { className: 'aicd-body', 'data-center': 'true' },
              h(State, { kind: 'error', error, onRetry: reload }))
          : data === null
            ? h('div', { className: 'aicd-body' }, h(State, { kind: 'loading' }))
            // Nothing scanned is not a score of nothing: Protection must offer the
            // same way in as Files does, or a first open is a dead end at "—".
            : (data.workspace === null || data.workspace === undefined || choosing === true)
                && (view === 'files' || view === 'protect')
              ? h('div', { className: 'aicd-body', 'data-center': 'true' },
                  h(NoWorkspace, { spaces, pending, scan, pick, scanError, choosing }))
              : view === 'files'
                ? h(FilesView, {
                  data, tree, at, setAt, pending, onAllow, onIgnore, onAddRule,
                  lastIgnored, onUndo
                })
                : view === 'settings'
                  ? h(SettingsView, {
                    data, conv, onDone: reload, onRescan: rescan, onProtect: () => setView('protect'),
                    surface: SURFACE
                  })
                  // Protection needs no workspace of its own: it reads counters
                  // and the conversation, both of which exist without a scan.
                  : h(ProtectView, {
                    data, conv, convError, progress, optimize: optimizeNow, onAllow, onIgnore,
                    onSettings: () => setView('settings'),
                    level, levelBusy, onLevel: pickLevel
                  }),
        postError !== null ? h('div', { className: 'aicd-note', 'data-tone': 'bad' }, tr('noteFailed')) : null
        )
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
            SURFACE = 'sidebar';
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

        // The aggregate page lives in the left navigation, under New Session:
        // a summary belongs to the app, not to one conversation.
        if (ctx.slots !== undefined && ctx.slots !== null && typeof ctx.slots.inject === 'function') {
          ctx.slots.inject('main', () =>
            ctx.slots.register({
              name: 'main',
              key: SUMMARY_ID,
              locale: NS,
              inject: () => ({
                openPanel: () => {
                  try {
                    if (ctx.sidebarRight !== undefined && ctx.sidebarRight !== null && typeof ctx.sidebarRight.openTab === 'function') {
                      ctx.sidebarRight.openTab(KIND);
                      return true;
                    }
                  } catch {
                    /* no sidebar: the page still works */
                  }
                  return false;
                }
              })
            }, SummaryPage)
          );
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register({
              name: 'sidebar.panellist',
              id: SUMMARY_ID,
              order: 12,
              locale: NS,
              label: () => tr('panelLabel')
            }, () => h(Icon, { name: 'spark', size: 16 }))
          );
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
