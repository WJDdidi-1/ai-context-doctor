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
        score: 'Health',
        scoreHint: 'out of 100',
        noise: 'noise',
        savedLabel: 'kept out',
        blockedBadge: 'blocked',
        refresh: 'Refresh',
        tabFiles: 'Files',
        tabInsights: 'Score',
        tabProtect: 'Protection',
        tabSettings: 'Settings',
        heroOne: 'read held back by your rules',
        heroMany: 'reads held back by your rules',
        heroWouldOne: 'read is junk and still reaches the model',
        heroWouldMany: 'reads are junk and still reach the model',
        heroAbout: 'about',
        heroKept: 'never reached the model',
        heroWouldCaption: 'Optimize writes the rules that stop them, then rescores this page.',
        heroStill: 'still getting through',
        heroNoneCaption: 'This conversation has not read anything worth holding back — no build output, no lockfile, no log.',
        sessionLine: 'This conversation',
        turns: 'turns',
        nextStep: 'One notch stricter blocks',
        nextFiles: 'more files ·',
        applyNext: 'Do that',
        nextDone: 'Turned up',
        rulesOn: 'rules in effect',
        openSettings: 'Change',
        tokens: 'tokens',
        tabNote: 'Note',
        tabChat: 'Chat',
        tabStrategy: 'Strategy',
        chatTitle: 'This conversation',
        chatScore: 'conversation score',
        chatTurns: 'turns',
        chatRead: 'read',
        chatFiles: 'files',
        chatNoise: 'noise reads',
        chatOptimize: 'Optimize this conversation',
        chatRulesWritten: 'Rules written',
        chatBlocked: 'reads now blocked',
        more: 'more',
        chatPick: 'Conversation',
        scoreConv: 'This conversation',
        scoreFolder: 'Reaches the model',
        scoreTwoHint: 'The first number is the folder as it is. The second is what still reaches the model once your rules and your strength are applied — that is the number Optimize moves.',
        scoreRaw: 'without your rules the same folder scores',
        rescan: 'Scan again',
        noteWhy: 'A few words in your own voice, read by the agent before it starts on this folder. Nothing here is enforced — it is context, not a command.',
        chatCurrent: 'current',
        chatNothing: 'Nothing read yet',
        chatNothingHint: 'This conversation has not opened a file yet. Its cost shows up here as it does — including anything the guard keeps out.',
        chatEmpty: 'No conversation data yet.',
        chatComposition: 'What this conversation spent tokens on',
        working: 'Working…',
        scoreTitle: 'Why this score',
        scoreHow: 'How the score is computed',
        scoreFormula: 'Start at 100. Each category can cost at most its weight, and what it costs is how much of the folder it occupies: build output 40, large files 25, lockfiles 20, logs 15. Your rules and your strength remove categories from the count, which is why the right-hand number is higher.',
        strengthTable: 'What each notch would score here',
        strengthNow: 'current',
        strengthUse: 'Use notch',
        strengthPreview: 'not saved yet',
        noteInjected: 'What the agent will read',
        noteToggleEntry: 'where to start',
        noteToggleAvoid: 'what not to open',
        noteToggleTests: 'how to check itself',
        optimizeTitle: 'Make it better',
        optimizeHint: 'Writes these rules into .aiignore so the same files stop reaching the model. Your own lines stay untouched, and Undo puts the file back exactly as it was.',
        optimize: 'Optimize this workspace',
        optimizeNow: 'Optimize now',
        rules: 'rules',
        scoreOnDisk: 'On disk',
        of: 'of',
        letThrough: 'let through by your rules and strength',
        phaseScan: 'Reading the folder…',
        phaseScore: 'Scoring what is left…',
        phaseWrite: 'Writing rules…',
        phaseVerify: 'Checking the result…',
        optimizeNothing: 'Nothing to add — your rules already cover it.',
        optimizeConversation: 'Optimize from this conversation',
        optimizeConversationHint: 'Writes the rules this conversation needs: the noise it read stays out next time. Your own lines are kept, and one click puts the file back.',
        optimizeNone: 'Nothing to add here — this folder is already lean.',
        optimizeFailed: 'Could not finish that:',
        optimized: 'Added rules:',
        scoreNow: 'Score:',
        undoOptimize: 'Undo',
        strategyTitle: 'How strict should I be?',
        strengthTitle: 'How strict should I be?',
        strengthHintShort: 'Pick a notch: the number on it is the score this folder would have, and picking one applies it right away.',
        strengthMoved: 'Strength moved to Protection, next to the score it changes: try a notch there and the conversation rescores without leaving the page.',
        strengthMovedGo: 'Go to Protection',
        strategyHint: 'Each notch trades detail for cleanliness. The numbers are computed against this folder before you commit, so pick the one whose trade you can live with — 3 is the balance we recommend.',
        strategySave: 'Use this setting',
        strategyWarning: 'At this strength small but real source files can be skipped. Check the blocked list after a session.',
        strategyOff: 'At this strength nothing is filtered except your own .aiignore rules.',
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
        pickTitle: 'Pick the folder to audit',
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
        overviewCurrent: 'open now',
        overviewOpen: 'Open the panel',
        overviewApply: 'Clean up',
        overviewWorst: 'Needs attention:',
        overviewFiles: 'files',
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
        rulesHint: 'Each line here keeps a kind of noise out. Remove one and those files can come back.',
        rulesNone: 'No rules yet. Optimize writes them for you, and you can always remove one here.',
        rulesRemove: 'Remove this rule',
        rulesRemoved: 'Removed.',
        chatPinned: 'showing an earlier conversation',
        chatFollowBack: 'Back to this conversation',
        strengthSaved: 'Saved. The score above now reflects it.',
        rescanHint: 'Scan this folder again',
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
        legendNoise: 'regenerated by a build, a lockfile or a log — reading it costs context and tells you nothing',
        legendReview: 'worth a look before it goes in: environment files, deploy scripts, big data',
        legendIgnored: 'a line in .aiignore already stops it, so the agent never sees it',
        suggestTitle: 'Worth a rule',
        suggestHint: 'One line here retires a whole family of files. Nothing is written until you click.',
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
        blockedTitle: 'Blocked from context',
        blockedNone: 'Nothing has been blocked in this workspace yet.',
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
        policyDeny: 'Default policy: generated output, lockfiles, logs and files over 1 MB are refused.',
        tokensHint: 'Token counts are a byte-based range, not a model bill.',
        close: 'Close',
        verdictAllowed: 'you allowed it'
      },
    //#endregion copy

      //#region copyZh
      zh: {
        entry: 'AIignore',
        tabTitle: 'AIignore',
        guideTitle: 'AIignore',
        guideDesc: '本次会话读了什么、挡了什么，以及你留给 AI 的说明。',
        score: '健康度',
        scoreHint: '满分 100',
        noise: '噪音',
        savedLabel: '已挡',
        blockedBadge: '项已拦',
        refresh: '刷新',
        tabFiles: '文件',
        tabInsights: '评分',
        tabProtect: '保护',
        tabSettings: '设置',
        heroOne: '次读取被你的规则挡住',
        heroMany: '次读取被你的规则挡住',
        heroWouldOne: '次读取是噪音，但现在还是会进模型',
        heroWouldMany: '次读取是噪音，但现在还是会进模型',
        heroAbout: '约',
        heroKept: '从没有进入模型',
        heroWouldCaption: '点「立即优化」会写下挡住它们的规则，并当场重新评分。',
        heroStill: '仍然会进模型',
        heroNoneCaption: '这次对话没有读过值得挡住的东西——没有构建产物、锁文件或日志。',
        sessionLine: '本次对话',
        turns: '轮',
        nextStep: '再严格一档会多挡下',
        nextFiles: '个文件 ·',
        applyNext: '就这样做',
        nextDone: '已调高',
        rulesOn: '条规则在生效',
        openSettings: '修改',
        tokens: 'tokens',
        tabNote: '说明',
        tabChat: '对话',
        tabStrategy: '策略',
        chatTitle: '本对话',
        chatScore: '本对话评分',
        chatTurns: '轮',
        chatRead: '已读',
        chatFiles: '个文件',
        chatNoise: '噪音读入',
        chatOptimize: '优化本对话',
        chatRulesWritten: '已写入规则',
        chatBlocked: '条读入现在会被拦截',
        more: '条更多',
        chatPick: '对话',
        scoreConv: '本对话',
        scoreFolder: '还会进模型',
        scoreTwoHint: '第一个数是目录本来的样子；第二个数是写进规则、加上筛选力度之后还有多少会进模型——优化按钮推动的就是第二个数。',
        scoreRaw: '不应用你的规则时，同一个文件夹是',
        rescan: '重新扫描',
        noteWhy: 'AI 每次开始干活前都会先读这段话。用它说明「这个仓库里什么重要」，用你自己的话就行。',
        chatCurrent: '当前',
        chatNothing: '还没有读入文件',
        chatNothingHint: '这个对话还没有打开过文件。读过之后，它的开销会出现在这里，被拦下的部分也会列出来。',
        chatEmpty: '还没有对话数据。',
        chatComposition: '这个对话的 token 花在哪',
        working: '处理中…',
        scoreTitle: '评分从哪来',
        scoreHow: '评分是怎么算的',
        scoreFormula: '从 100 分起扣。每类最多扣掉它的权重，实际扣多少取决于它占这个文件夹的比例：构建产物 40、大文件 25、锁文件 20、日志 15。你写的规则和筛选力度会把相应类别从扣分里去掉，所以右边那个数会更高。',
        strengthTable: '这个仓库在每一档下的分数',
        strengthNow: '当前',
        strengthUse: '使用第',
        strengthPreview: '尚未保存',
        noteInjected: 'AI 会读到的内容',
        noteToggleEntry: '从哪里开始看',
        noteToggleAvoid: '哪些不要打开',
        noteToggleTests: '怎么自检',
        optimizeTitle: '一键优化',
        optimizeHint: '把这些规则写进 .aiignore，同一批文件就不会再进模型了。你自己写的行不会动，撤销会把文件逐字节还原。',
        optimize: '优化这个工作区',
        optimizeNow: '立即优化',
        rules: '条规则',
        scoreOnDisk: '磁盘上',
        of: '共',
        letThrough: '会进入模型（规则与力度之后）',
        phaseScan: '正在读取目录…',
        phaseScore: '正在计算剩余噪音…',
        phaseWrite: '正在写入规则…',
        phaseVerify: '正在核对结果…',
        optimizeNothing: '没有可加的规则——现有的规则已经覆盖了。',
        optimizeConversation: '按这个对话优化',
        optimizeConversationHint: '把这个对话读到的噪音写成规则，下次就不进了。你原有的行会保留，一次点击就能还原。',
        optimizeNone: '没有需要添加的规则：这个工作区已经很干净。',
        optimizeFailed: '没能完成这次操作：',
        optimized: '已添加规则：',
        scoreNow: '分数：',
        undoOptimize: '撤销',
        strategyTitle: '筛选力度',
        strengthTitle: '要多严格？',
        strengthHintShort: '挑一档就生效：每格上的数字，是这个文件夹在这一档下的分数。',
        strengthMoved: '力度已经挪到「保护」页，就在它改变的那个分数旁边：在那里换档，当前对话会立刻重新评分，不用来回切页。',
        strengthMovedGo: '去保护页',
        strategyHint: '每一档都是拿细节换整洁。选中之前就先把这个仓库在每档下的分数算给你看，挑一个你愿意接受的取舍——我们推荐第 3 档。',
        strategySave: '使用这个档位',
        strategyWarning: '这个档位可能跳过体积不大但确实有用的源文件，会话结束后请看一眼被拦列表。',
        strategyOff: '这个档位只应用你自己写的 .aiignore 规则，其余一律放行。',
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
        pickTitle: '选择要检查的文件夹',
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
        overviewCurrent: '正在打开',
        overviewOpen: '打开面板',
        overviewApply: '清理',
        overviewWorst: '最该先处理：',
        overviewFiles: '个文件',
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
        rulesHint: '这里每一行都挡住一类噪音。删掉一行，那些文件就会重新进入上下文。',
        rulesNone: '还没有规则。点「优化」会自动写入，也可以在这里逐条删除。',
        rulesRemove: '删除这条规则',
        rulesRemoved: '已删除。',
        chatPinned: '正在查看较早的对话',
        chatFollowBack: '回到当前对话',
        strengthSaved: '已保存，上面的分数已经按这一档重算。',
        rescanHint: '重新扫描这个文件夹',
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
        legendNoise: '构建产物、锁文件或日志——重新生成就有，读进来只占上下文',
        legendReview: '值得先看一眼：环境文件、部署脚本、大数据文件',
        legendIgnored: '.aiignore 里已经有一行挡住它，AI 根本看不到',
        suggestTitle: '值得加一条规则',
        suggestHint: '这里一行就能收掉一整类文件；不点就不会写入任何东西。',
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
        blockedTitle: '挡在上下文之外',
        blockedNone: '这个工作区还没有文件被挡下。',
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
        policyDeny: '默认策略：构建产物、锁文件、日志与超过 1 MB 的文件会被拒绝读取。',
        tokensHint: 'token 数是按字节估算的区间，不是模型账单。',
        close: '关闭',
        verdictAllowed: '你已放行'
      }
    };

    // Single source of truth: this text must match ui/panel.css byte for byte.
    //#endregion copyZh

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
  position: relative;
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

.aicd-title {
  font: var(--dsw-font-xs-strong-13, 600 13px/1.35 system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* The line under the title: where the folder is, and one badge at most. */
.aicd-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-tertiary, currentColor);
}

.aicd-card-value[data-tone='good'] { color: var(--dsw-alias-state-success-primary, #2f7d4f); }
.aicd-card-value[data-tone='warn'] { color: var(--dsw-alias-state-warn-primary, #a8700f); }
.aicd-card-value[data-tone='bad'] { color: var(--dsw-alias-state-error-primary, #b23b3b); }

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

.aicd-follow {
  padding: 1px 6px;
  border-radius: var(--dsw-radius-xs, 4px);
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.9));
  font-size: var(--dsw-font-xxxs-11, 11px);
  white-space: nowrap;
}

.aicd-menu {
  position: absolute;
  top: 30px;
  right: 8px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  min-width: 168px;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-2, #1f1f24);
  box-shadow: var(--dsw-elevation-panel, 0 8px 24px rgba(0, 0, 0, 0.28));
}

.aicd-menu-item {
  padding: 6px 10px;
  border: none;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-primary, #f2f2f2);
  font: inherit;
  font-size: var(--dsw-font-xxs-12, 12px);
  text-align: left;
  cursor: pointer;
}

.aicd-menu-item:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}

.aicd-menu-item[aria-disabled="true"] {
  opacity: 0.45;
  cursor: default;
}

.aicd-page {
  height: 100%;
  overflow: auto;
  padding: 32px 24px 48px;
  color: var(--dsw-alias-label-primary, #f2f2f2);
  background: var(--dsw-alias-bg-base, transparent);
}

.aicd-page-inner {
  max-width: 720px;
  margin: 0 auto;
}

.aicd-page-title {
  margin: 0 0 4px;
  font-size: var(--dsw-font-m-18, 18px);
  font-weight: 600;
}

.aicd-page-hint {
  margin: 0 0 20px;
  color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));
  font-size: var(--dsw-font-xxs-12, 12px);
}

.aicd-page-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--dsw-radius-md, 12px);
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
  margin-bottom: 8px;
}

.aicd-page-row:hover {
  border-color: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
}

.aicd-page-score {
  min-width: 40px;
  font-size: var(--dsw-font-m-18, 18px);
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.95));
}

.aicd-page-score[data-tone="good"] {
  color: var(--dsw-alias-state-success-primary, #4ea36b);
}

.aicd-page-score[data-tone="warn"] {
  color: var(--dsw-alias-state-warn-primary, #e0a33a);
}

.aicd-page-score[data-tone="bad"] {
  color: var(--dsw-alias-state-error-primary, #d9534f);
}

.aicd-page-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.aicd-page-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--dsw-font-xs-13, 13px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-page-badge {
  padding: 0 6px;
  border-radius: var(--dsw-radius-xs, 4px);
  background: var(--dsw-alias-state-business-primary, #3b82f6);
  color: #ffffff;
  font-size: var(--dsw-font-xxxs-11, 11px);
}

.aicd-page-meta {
  color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));
  font-size: var(--dsw-font-xxxs-11, 11px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-page-noise {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.85));
  font-size: var(--dsw-font-xxxs-11, 11px);
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
}

.aicd-pick {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  max-width: 320px;
  margin: 0 auto 12px;
}

.aicd-pick-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: var(--dsw-alias-label-primary, #f2f2f2);
  font: inherit;
  font-size: var(--dsw-font-xxs-12, 12px);
  text-align: left;
  cursor: pointer;
}

.aicd-pick-row:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  border-color: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
}

.aicd-pick-row:disabled {
  opacity: 0.5;
  cursor: default;
}

.aicd-pick-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-pick-meta {
  margin-left: auto;
  color: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.9));
  font-size: var(--dsw-font-xxxs-11, 11px);
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

.aicd-opt {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0 12px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.18));
}

.aicd-opt-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.aicd-opt-title {
  font-family: var(--dsw-font-xs-strong-13, 600 13px system-ui);
  color: var(--dsw-alias-label-primary, #f2f2f2);
}

.aicd-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.aicd-bar-name {
  flex: none;
  width: 72px;
  color: var(--dsw-alias-label-secondary, rgba(242, 242, 242, 0.72));
}

.aicd-bar {
  flex: 1;
  height: 4px;
  border-radius: var(--dsw-radius-xs, 4px);
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.18));
  overflow: hidden;
}

.aicd-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--dsw-alias-state-warn-primary, #e0a33a);
}

.aicd-bar-fill[data-empty='true'] {
  background: transparent;
}

.aicd-bar-loss {
  flex: none;
  width: 58px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, rgba(242, 242, 242, 0.55));
}

.aicd-slider {
  width: 100%;
  margin: 2px 0;
  accent-color: var(--dsw-alias-state-business-primary, #5b8def);
}

.aicd-scale {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.aicd-scale-step {
  flex: 1;
  padding: 3px 0;
  border: 1px solid transparent;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-tertiary, rgba(242, 242, 242, 0.55));
  font: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.aicd-scale-step[data-active='true'] {
  border-color: var(--dsw-alias-state-business-primary, #5b8def);
  color: var(--dsw-alias-label-primary, #f2f2f2);
}

.aicd-level {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aicd-level-name {
  font-family: var(--dsw-font-xxs-strong-12, 600 12px system-ui);
  color: var(--dsw-alias-label-primary, #f2f2f2);
}

.aicd-level-note {
  font-size: 11px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, rgba(242, 242, 242, 0.55));
}

/* The Chat tab: one conversation, and what it cost. */
.aicd-chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-x: hidden;
}

.aicd-chat .aicd-row {
  max-width: 100%;
}

.aicd-chat .aicd-row-name {
  min-width: 0;
}

.aicd-chat-title {
  font: var(--dsw-font-xs-strong-13, 600 13px/1.4 sans-serif);
  color: var(--dsw-alias-label-primary, inherit);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-chat-meta {
  font: var(--dsw-font-xxxs-11, 11px/1.4 sans-serif);
  color: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.9));
}

.aicd-chat-score {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.aicd-comp {
  display: flex;
  height: 8px;
  border-radius: var(--dsw-radius-xs, 4px);
  overflow: hidden;
  background: var(--dsw-alias-bg-skeleton, rgba(127, 127, 127, 0.18));
}

.aicd-comp-seg {
  display: block;
  height: 100%;
}

.aicd-comp-seg[data-seg='assistant'],
.aicd-swatch[data-seg='assistant'] {
  background: var(--dsw-alias-state-idle-primary, #9a9a9a);
}

.aicd-comp-seg[data-seg='tool'],
.aicd-swatch[data-seg='tool'] {
  background: var(--dsw-alias-state-business-primary, #6f9fe0);
}

.aicd-comp-seg[data-seg='user'],
.aicd-swatch[data-seg='user'] {
  background: var(--dsw-alias-state-success-primary, #4ea36b);
}

.aicd-comp-seg[data-seg='inject'],
.aicd-swatch[data-seg='inject'] {
  background: var(--dsw-alias-state-warn-primary, #e0a33a);
}

.aicd-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font: var(--dsw-font-xxxs-11, 11px/1.4 sans-serif);
  color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));
}

.aicd-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.aicd-swatch {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.aicd-blocked {
  padding: 4px 0 6px;
}

.aicd-blocked-actions {
  display: flex;
  gap: 6px;
  padding-left: 24px;
}

.aicd-chat-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aicd-select {
  width: 100%;
  padding: 5px 8px;
  border-radius: var(--dsw-radius-sm, 8px);
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: var(--dsw-alias-label-secondary, inherit);
  font: var(--dsw-font-xxs-12, 12px/1.4 sans-serif);
}

/* ---------- fold: the scoring standard, on demand ---------- */

.aicd-fold {
  margin-top: 8px;
  border-top: 1px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.18));
  padding-top: 6px;
}

.aicd-fold-head {
  cursor: pointer;
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-caption, currentColor);
  padding: 2px 0;
}

.aicd-fold-head:hover { color: var(--dsw-alias-label-primary, currentColor); }

.aicd-fold-head:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4176e6);
  outline-offset: 2px;
  border-radius: var(--dsw-radius-xs, 4px);
}

.aicd-fold-body {
  margin: 6px 0 0;
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui);
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, currentColor);
}

/* ---------- strength: five notches, five numbers ---------- */

.aicd-levels {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}

.aicd-level-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.aicd-level-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }

.aicd-level-row[data-active="true"] {
  border-color: var(--dsw-alias-state-business-primary, #4176e6);
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}

.aicd-level-row:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4176e6);
  outline-offset: 1px;
}

.aicd-level-num {
  font: var(--dsw-font-xxs-12, 12px/18px system-ui);
  color: var(--dsw-alias-label-tertiary, currentColor);
  text-align: center;
}

.aicd-level-label {
  font: var(--dsw-font-xxs-12, 12px/18px system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.aicd-follow[data-state='pinned'] {
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.35));
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.aicd-follow[data-state='pinned']:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1));
  color: var(--dsw-alias-label-primary, inherit);
}

.aicd-rule {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 2px 4px 2px 6px;
  border-radius: var(--dsw-radius-sm, 8px);
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.3));
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.06));
}

.aicd-rule-text {
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 11px;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-rule-x {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.aicd-rule-x:hover {
  background: var(--dsw-alias-interactive-bg-hover-danger, rgba(200, 60, 60, 0.12));
  color: var(--dsw-alias-state-error-primary, #c83c3c);
}

.aicd-rule-x:disabled {
  opacity: 0.5;
  cursor: progress;
}

.aicd-level-meta {
  margin-left: 6px;
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
  font-size: 11px;
}

.aicd-level-score {
  font: var(--dsw-font-xxs-12, 12px/18px system-ui);
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary, currentColor);
  text-align: right;
}

/* ---------- notes: the exact text the agent reads ---------- */

.aicd-notes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.18));
}

.aicd-injected {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.18));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.06));
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, monospace);
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, currentColor);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* ---------- summary page: actions per row ---------- */

.aicd-page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.aicd-page-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.aicd-action {
  padding: 0 10px 8px;
}

.aicd-progress {
  position: relative;
  height: 28px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aicd-progress-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--dsw-alias-state-business-primary, #4a7edb);
  opacity: 0.28;
  transition: width 220ms ease;
}

.aicd-progress-label {
  position: relative;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.95));
}

.aicd-toast {
  margin: 0 12px 6px;
  padding: 5px 8px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  color: var(--dsw-alias-label-secondary, inherit);
  font: var(--dsw-font-xxxs-11, 11px/14px inherit);
}

.aicd-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.06));
}

.aicd-result-score {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.aicd-covered {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aicd-covered .aicd-row {
  cursor: default;
}

/* --- Protection: one number, one action ------------------------------- */
.aicd-protect {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 4px;
}

.aicd-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 0 2px;
}

.aicd-hero-num {
  font: var(--dsw-font-xl-24-strong, 600 24px/1.1 inherit);
  font-size: 40px;
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-state-business-primary, #4a7cf7);
}

.aicd-hero-label {
  font: var(--dsw-font-xxs-12, 12px/1.4 inherit);
  color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.95));
}

.aicd-hero-sub {
  margin-top: 6px;
  max-width: 280px;
  text-align: center;
  font: var(--dsw-font-xxxs-11, 11px/1.5 inherit);
  color: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.8));
}

.aicd-hero-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.aicd-hero-meta {
  font: var(--dsw-font-xxxs-11, 11px/1.5 inherit);
  color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.85));
  text-align: center;
}

.aicd-next {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--dsw-radius-md, 12px);
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
  background: var(--dsw-alias-bg-layer-1, transparent);
}

.aicd-next-text {
  font: var(--dsw-font-xxs-12, 12px/1.5 inherit);
  color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.95));
}

.aicd-next .aicd-btn {
  align-self: flex-start;
}

.aicd-hero-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
  font: var(--dsw-font-xxxs-11, 11px/1.4 inherit);
  color: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.8));
}

.aicd-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--dsw-alias-state-business-primary, #4a7cf7);
  font: inherit;
  cursor: pointer;
}

.aicd-link:hover {
  text-decoration: underline;
}

.aicd-block-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.aicd-block-row:last-child {
  border-bottom: none;
}

.aicd-block-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--dsw-font-xxs-12, 12px/1.4 inherit);
  color: var(--dsw-alias-label-primary, inherit);
}

.aicd-block-meta {
  flex: none;
  white-space: nowrap;
  font: var(--dsw-font-xxxs-11, 11px/1.4 inherit);
  color: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.8));
}

.aicd-section-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* A list, not a header line: .aicd-section is a flex row and flattens these. */
.aicd-blocked-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 6px;
}

.aicd-blocked-title {
  font: var(--dsw-font-xxxs-strong-11, 500 11px/14px system-ui);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-caption, currentColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-bottom: 2px;
}

/* ------------------------------------------------------------------ *
 * Layout pass: header, tabs, and the protection screen.
 * Everything here uses the host tokens with a plain fallback, so the
 * panel looks like the app it lives in, in both themes.
 * ------------------------------------------------------------------ */

.aicd-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px 0;
  position: relative;
}

.aicd-head-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.aicd-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  font: var(--dsw-font-xs-strong-13, 600 13px/18px system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-brand-icon {
  color: var(--dsw-alias-label-tertiary, currentColor);
}

.aicd-head-tools {
  display: flex;
  align-items: center;
  gap: 2px;
}

.aicd-head-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.aicd-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--dsw-font-xxxs-11, 11px/15px ui-monospace, SFMono-Regular, monospace);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-chipdot {
  flex: none;
  padding: 1px 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.25));
  border-radius: 999px;
  background: none;
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-tertiary, currentColor);
  cursor: default;
}

.aicd-chipdot[data-state='pinned'] {
  color: var(--dsw-alias-state-business-primary, #4d6bfe);
  border-color: var(--dsw-alias-state-business-primary, #4d6bfe);
  cursor: pointer;
}

.aicd-tabs {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
  padding: 0;
  border: none;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  border-radius: 0;
  background: none;
}

.aicd-tab {
  appearance: none;
  margin-bottom: -1px;
  padding: 8px 0 7px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  font: var(--dsw-font-xxs-12, 12px/16px system-ui);
  color: var(--dsw-alias-label-tertiary, currentColor);
  cursor: pointer;
}

.aicd-tab:hover {
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-tab[aria-selected='true'] {
  color: var(--dsw-alias-label-primary, currentColor);
  border-bottom-color: var(--dsw-alias-state-business-primary, #4d6bfe);
  background: none;
}

.aicd-protect {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px 18px;
}

.aicd-stat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.04));
}

.aicd-stat-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.aicd-stat-num {
  font: var(--dsw-font-xl-strong-24, 600 30px/34px system-ui);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-stat-text {
  min-width: 0;
}

.aicd-stat-label {
  font: var(--dsw-font-xxs-12, 12px/16px system-ui);
  color: var(--dsw-alias-label-secondary, currentColor);
}

.aicd-item-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 16px;
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-stat-sub {
  margin-top: 2px;
  font: var(--dsw-font-xxxs-11, 11px/15px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-stat-meta {
  font: var(--dsw-font-xxxs-11, 11px/15px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-btn[data-wide='true'] {
  width: 100%;
  height: 32px;
  border-radius: var(--dsw-radius-sm, 8px);
  font-weight: 600;
}

.aicd-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  border-radius: var(--dsw-radius-sm, 8px);
  background: none;
}

.aicd-hint-text {
  flex: 1;
  min-width: 0;
  font: var(--dsw-font-xxxs-11, 11px/15px system-ui);
  color: var(--dsw-alias-label-secondary, currentColor);
}

.aicd-textbtn {
  flex: none;
  padding: 2px 0;
  border: none;
  background: none;
  font: var(--dsw-font-xxxs-strong-11, 600 11px/15px system-ui);
  color: var(--dsw-alias-state-business-primary, #4d6bfe);
  cursor: pointer;
}

.aicd-textbtn:disabled {
  color: var(--dsw-alias-label-caption, currentColor);
  cursor: default;
}

.aicd-list {
  display: flex;
  flex-direction: column;
}

.aicd-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 2px 4px;
}

.aicd-list-title {
  font: var(--dsw-font-xxxs-strong-11, 600 10px/14px system-ui);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-list-count {
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-list-empty {
  padding: 10px 2px;
  font: var(--dsw-font-xxxs-11, 11px/15px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px;
  border-radius: var(--dsw-radius-sm, 8px);
}

.aicd-item:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1));
}

.aicd-item-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.aicd-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--dsw-font-xxs-12, 12px/16px system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-item-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--dsw-font-xxxs-11, 10px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-item-actions {
  display: flex;
  gap: 2px;
  flex: none;
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

.aicd-minibtn {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid transparent;
  border-radius: var(--dsw-radius-xs, 4px);
  background: none;
  color: var(--dsw-alias-label-tertiary, currentColor);
  cursor: pointer;
}

.aicd-minibtn:hover {
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.2));
  background: var(--dsw-alias-bg-base, transparent);
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-minibtn:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe);
  outline-offset: 1px;
}

.aicd-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px;
  font: var(--dsw-font-xxxs-11, 11px/15px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

/* Files tab, same rhythm as the protection screen. */

.aicd-files {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 10px 14px 16px;
}

.aicd-toolbar {
  display: block;
  padding: 0;
}

.aicd-search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.04));
  color: var(--dsw-alias-label-tertiary, currentColor);
}

.aicd-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  font: var(--dsw-font-xxs-12, 12px/16px system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-search:focus-within {
  border-color: var(--dsw-alias-state-business-primary, #4d6bfe);
}

.aicd-filters {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0 2px;
  min-width: 0;
}

.aicd-filters .aicd-count {
  margin-left: auto;
  flex: none;
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-chip {
  flex: none;
  padding: 3px 8px;
  border: none;
  border-radius: 999px;
  background: none;
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui);
  color: var(--dsw-alias-label-secondary, currentColor);
  cursor: pointer;
}

.aicd-chip:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1));
}

.aicd-chip[data-active='true'] {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.16));
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-subbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 2px 0 4px;
  min-height: 20px;
}

.aicd-sortbtn {
  padding: 2px 0;
  border: none;
  background: none;
  font: var(--dsw-font-xxxs-11, 11px/15px system-ui);
  color: var(--dsw-alias-label-tertiary, currentColor);
  cursor: pointer;
}

.aicd-sortbtn:hover {
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-subbar .aicd-chip {
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.06));
}

.aicd-crumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 0 6px;
  min-width: 0;
  overflow: hidden;
}

.aicd-list-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--dsw-font-xxxs-11, 11px/14px ui-monospace, monospace);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 6px;
  border-radius: var(--dsw-radius-sm, 8px);
  cursor: pointer;
}

.aicd-row:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1));
}

.aicd-row[data-selected='true'] {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.16));
  box-shadow: none;
}

.aicd-row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--dsw-font-xxs-12, 12px/16px system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-row-meta {
  flex: none;
  font: var(--dsw-font-xxxs-11, 10px/14px system-ui);
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-caption, currentColor);
  text-align: right;
}

.aicd-row-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 16px;
  color: var(--dsw-alias-label-tertiary, currentColor);
}

.aicd-badge {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  font: var(--dsw-font-xxxs-11, 10px/14px system-ui);
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-secondary, currentColor);
}

.aicd-badge[data-tone='noise'] {
  background: var(--dsw-alias-state-warn-tertiary, rgba(224, 163, 58, 0.16));
  color: var(--dsw-alias-state-warn-primary, #a4700f);
}

.aicd-badge[data-tone='review'] {
  background: var(--dsw-alias-state-business-tertiary, rgba(77, 107, 254, 0.14));
  color: var(--dsw-alias-state-business-primary, #4d6bfe);
}

/* Settings tab: one column of labelled blocks, same rhythm as the rest. */

.aicd-body .aicd-opt,
.aicd-opt {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 0;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.aicd-opt:first-child {
  border-top: none;
  padding-top: 4px;
}

.aicd-opt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.aicd-opt-title {
  font: var(--dsw-font-xxxs-strong-11, 600 10px/14px system-ui);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-opt-head .aicd-count {
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-levels {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aicd-levels .aicd-section-title {
  padding: 2px 0 4px;
  font: var(--dsw-font-xxxs-strong-11, 600 10px/14px system-ui);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-level-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--dsw-radius-sm, 8px);
  background: none;
  text-align: left;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary, currentColor);
}

.aicd-level-row:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1));
}

.aicd-level-row[data-active='true'] {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.14));
  color: var(--dsw-alias-label-primary, currentColor);
  box-shadow: inset 2px 0 0 var(--dsw-alias-state-business-primary, #4d6bfe);
}

.aicd-level-num {
  font: var(--dsw-font-xxxs-11, 11px/14px ui-monospace, monospace);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-level-label {
  font: var(--dsw-font-xxs-12, 12px/16px system-ui);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aicd-level-meta {
  margin-left: 6px;
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-level-score {
  font: var(--dsw-font-xxs-12, 12px/16px system-ui);
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-level {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 8px;
}

.aicd-level-name {
  font: var(--dsw-font-xxs-strong-12, 600 12px/16px system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-level-note {
  font: var(--dsw-font-xxxs-11, 11px/15px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

/* Title first: the panel answers "which conversation", then "which folder". */

.aicd-head-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--dsw-font-xs-strong-13, 600 13px/18px system-ui);
  color: var(--dsw-alias-label-primary, currentColor);
}

.aicd-head-brand {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  font: var(--dsw-font-xxxs-11, 11px/14px system-ui);
  color: var(--dsw-alias-label-caption, currentColor);
}

.aicd-head-brand .aicd-brand-icon {
  width: 11px;
  height: 11px;
}

/* Loading, empty and failed share one shape: icon, one sentence, one action.
   The detail line carries the reason a request failed — a status code, not a
   guess about the user's setup. */
.aicd-state {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aicd-state-skel {
  padding: 4px 0;
}

.aicd-state-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.aicd-state-detail {
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 11px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
  overflow-wrap: anywhere;
}

/* The inline variant sits inside a card (the conversation line on Protection). */
.aicd-state-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.16));
  font-size: 11px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
}

.aicd-state-inline[data-tone='bad'] {
  color: var(--dsw-alias-state-warn-label, #b0741d);
}

.aicd-levels-state {
  padding: 4px 0 2px;
}

/* The strength ladder, where the score is.
   Five cells, each labelled with the score that notch would leave: a row of
   buttons you can read as a table, and a table you can press. */
.aicd-strength {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0 14px;
  border-top: 1px solid var(--dsw-alias-border-l1, #e6e6e6);
}

.aicd-strength-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.aicd-strength-now {
  font: var(--dsw-font-xxxs-11, 11px);
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
}

.aicd-strength-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.aicd-strength-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px 5px;
  border: 1px solid var(--dsw-alias-border-l1, #e6e6e6);
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-primary, #1b1b1f);
  cursor: pointer;
  font-family: inherit;
}

.aicd-strength-cell:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, #f2f2f3);
}

.aicd-strength-cell[data-active='true'] {
  border-color: var(--dsw-alias-state-business-primary, #4c6ef5);
  background: var(--dsw-alias-state-business-tertiary, #eef1ff);
}

.aicd-strength-cell:disabled {
  cursor: default;
  opacity: 0.6;
}

.aicd-strength-num {
  font: var(--dsw-font-xxxs-11, 11px);
  color: var(--dsw-alias-label-caption, #9a9a9a);
  font-variant-numeric: tabular-nums;
}

.aicd-strength-score {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.aicd-strength-cell[data-active='true'] .aicd-strength-score {
  color: var(--dsw-alias-state-business-primary, #4c6ef5);
}

.aicd-strength-hint {
  font: var(--dsw-font-xxxs-11, 11px);
  line-height: 1.45;
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
}

.aicd-strength-state {
  padding: 10px 0 14px;
  border-top: 1px solid var(--dsw-alias-border-l1, #e6e6e6);
}

/* ---------- what the three verdicts mean, and the rules they suggest ------ */

.aicd-legend {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0 0 8px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.18));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.04));
}

.aicd-legend-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
}

.aicd-legend-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-label-tertiary, #8b8b8b);
}

.aicd-legend-dot[data-tone='noise'] {
  background: var(--dsw-alias-state-warn-primary, #d9a341);
}

.aicd-legend-dot[data-tone='review'] {
  background: var(--dsw-alias-state-business-primary, #4176e6);
}

.aicd-legend-label {
  flex: none;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary, #6b6b6b);
}

.aicd-legend-text {
  min-width: 0;
}

.aicd-suggest {
  margin: 0 0 10px;
}

.aicd-suggest-hint {
  margin: 2px 0 6px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
}

.aicd-suggest-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.aicd-suggest-rules .aicd-chip {
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
}

.aicd-stat-num[data-tone='good'] {
  color: var(--dsw-alias-state-success-primary, #3f9c6a);
}

.aicd-stat-num[data-tone='warn'] {
  color: var(--dsw-alias-state-warn-primary, #d9a341);
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
    function useConversation(pinnedSession, nonce) {
      const [conv, setConv] = useState(null);
      const [error, setError] = useState(null);
      const [tick, setTick] = useState(0);

      useEffect(() => {
        let live = true;
        const target = pinnedSession === null
          ? '/aiignore/conversation'
          : `/aiignore/conversation?session=${encodeURIComponent(pinnedSession)}`;
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
      }, [pinnedSession, tick, nonce]);

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
        h('div', { className: 'aicd-subbar' },
          h('button', {
            key: 'sort',
            type: 'button',
            className: 'aicd-sortbtn',
            'aria-label': tr('sortSize'),
            onClick: () => setSort(sort === 'size' ? 'name' : 'size')
          }, sort === 'size' ? tr('sortSize') : tr('sortName'), ' ▾'),
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
            h('span', { className: 'aicd-list-path', title: at === '' ? (data.workspace || '') : at }, at === '' ? (data.workspace || '') : at)
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
          rows: 4,
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
        h('div', { className: 'aicd-section-title' }, tr('noteInjected')),
        h('pre', { className: 'aicd-injected' }, injected.length === 0 ? '—' : injected),
        h('p', { className: 'aicd-note' }, tr('noteHint')),
        status === 'saved' ? h('p', { className: 'aicd-note', 'data-tone': 'ok' }, tr('noteSaved')) : null,
        status === 'too-long' ? h('p', { className: 'aicd-note', 'data-tone': 'bad' }, tr('noteTooLong')) : null,
        status === 'failed' ? h('p', { className: 'aicd-note', 'data-tone': 'bad' }, tr('noteFailed')) : null,
        status === 'empty' ? h('p', { className: 'aicd-note' }, tr('noteEmpty')) : null
      );
    }

    function SettingsView({ data, conv, onDone, onRescan, onProtect }) {
      const scanned = data.scanned || {};
      const effective = typeof scanned.effectiveScore === 'number' ? scanned.effectiveScore : null;
      const raw = typeof scanned.healthScore === 'number' ? scanned.healthScore : null;

      return h('div', { className: 'aicd-body' },
        h('div', { className: 'aicd-opt' },
          h('div', { className: 'aicd-opt-head' },
            h('span', { className: 'aicd-opt-title' }, tr('strategyTitle')),
            h('span', { className: 'aicd-count' }, `${typeof data.level === 'number' ? data.level : 3} / 5`)
          ),
          h('div', { className: 'aicd-note' }, tr('strengthMoved')),
          h('div', { className: 'aicd-btn-row' },
            h('button', { type: 'button', className: 'aicd-textbtn', onClick: onProtect }, tr('strengthMovedGo')))
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
        )
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
    function StrengthStrip({ data, level, busy, onPick }) {
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
        h('div', { className: 'aicd-strength-head' },
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

    function ProtectView({ data, conv, convError, progress, optimize, onAllow, onIgnore, onSettings, level, levelBusy, onLevel }) {
      const stats = data.stats !== null && typeof data.stats === 'object' ? data.stats : {};
      const blockedReads = typeof stats.blockedReads === 'number' ? stats.blockedReads : 0;
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

      // Three states worth telling apart: rules hold something back, rules are
      // missing but there is something to hold back, or this conversation simply
      // never read junk. Reporting `0` for all three is what made the page feel
      // decorative.
      const headline = keptOut > 0
        ? { value: keptOut, label: tr(keptOut === 1 ? 'heroOne' : 'heroMany'), tone: 'good' }
        : pendingReads > 0
          ? { value: pendingReads, label: tr(pendingReads === 1 ? 'heroWouldOne' : 'heroWouldMany'), tone: 'warn' }
          : { value: 0, label: tr('heroMany'), tone: 'neutral' };

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
          h('div', { className: 'aicd-stat-top' },
            h('div', { className: 'aicd-stat-num', 'data-tone': headline.tone }, String(headline.value)),
            h('div', { className: 'aicd-stat-label' }, headline.label)
          ),
          h('div', { className: 'aicd-stat-sub' }, headline.value === 0
            ? tr('heroNoneCaption')
            : h(null, null,
                keptOut > 0
                  ? `${tr('heroAbout')} ${formatTokensCompact(keptOutTokens)} ${tr('heroKept')}`
                  : tr('heroWouldCaption'),
                pendingReads > 0 && keptOut > 0
                  ? ` · ${pendingReads} ${tr('heroStill')}`
                  : null
              )),
          h('button', {
            type: 'button',
            className: 'aicd-btn',
            'data-variant': 'primary',
            'data-wide': 'true',
            disabled: progress !== null,
            onClick: optimize
          }, progress === null ? tr('optimizeNow') : tr('working')),
          progress === null ? null : h('div', { className: 'aicd-progress', role: 'progressbar', 'aria-valuenow': progress.pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
            h('div', { className: 'aicd-progress-bar', style: { width: `${progress.pct}%` } }),
            h('div', { className: 'aicd-progress-label' }, progress.label)
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

        h(StrengthStrip, { data, level, busy: levelBusy, onPick: onLevel }),

        potential === null ? null : h('div', { className: 'aicd-hint' },
          h('span', { className: 'aicd-hint-text' },
            `${tr('nextStep')} ${potential.extraFiles} ${tr('nextFiles')} · ${tr('heroAbout')} ${shortTokens(potential.extraTokens)} ${tr('tokens')}`),
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
            h('span', { className: 'aicd-head-brand' },
              h(Icon, { name: 'lock', size: 11, className: 'aicd-brand-icon' }),
              h('span', null, tr('tabTitle'))
            ),
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
      const { conv, error: convError } = useConversation(pinnedSession, convNonce);
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
            if (done(payload)) reloadTree();
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
        const target = typeof cwd === 'string' && cwd.length > 0 ? `/aiignore/scan?cwd=${encodeURIComponent(cwd)}` : '/aiignore/scan';
        const body = typeof cwd === 'string' && cwd.length > 0
          ? { cwd }
          : (conv !== null && conv !== undefined && typeof conv.id === 'string' ? { session: conv.id } : {});
        setToast(null);
        setProgress({ pct: 8, label: tr('phaseScan') });

        fetch(target, { method: 'POST', headers: { 'content-type': 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            if (payload === null || payload === undefined || payload.scanned === undefined) {
              throw new Error('scan');
            }
            setProgress({ pct: 42, label: tr('phaseScore') });
            return fetch('/aiignore/optimize', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body)
            });
          })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => {
            setProgress({ pct: 74, label: tr('phaseWrite') });
            if (payload !== null && payload !== undefined && payload.report !== undefined) {
              applyReport(payload.report);
            }
            setProgress({ pct: 92, label: tr('phaseVerify') });
            const added = Array.isArray(payload === null || payload === undefined ? undefined : payload.added) ? payload.added.length : 0;
            setToast(added === 0
              ? tr('optimizeNothing')
              : `${tr('scoreMoved')} ${payload.before} → ${payload.after} · ${added} ${tr('rules')}`);
            reload();
            reloadTree();
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
        error !== null
          ? h('div', { className: 'aicd-body', 'data-center': 'true' },
              h(State, { kind: 'error', error, onRetry: reload }))
          : data === null
            ? h('div', { className: 'aicd-body' }, h(State, { kind: 'loading' }))
            : (data.workspace === null || data.workspace === undefined || choosing === true) && view === 'files'
              ? h('div', { className: 'aicd-body', 'data-center': 'true' },
                  h(NoWorkspace, { spaces, pending, scan, pick, scanError, choosing }))
              : view === 'files'
                ? h(FilesView, {
                  data, tree, at, setAt, pending, onAllow, onIgnore, onAddRule,
                  lastIgnored, onUndo
                })
                : view === 'settings'
                  ? h(SettingsView, { data, conv, onDone: reload, onRescan: rescan, onProtect: () => setView('protect') })
                  // Protection needs no workspace of its own: it reads counters
                  // and the conversation, both of which exist without a scan.
                  : h(ProtectView, {
                    data, conv, convError, progress, optimize: optimizeNow, onAllow, onIgnore,
                    onSettings: () => setView('settings'),
                    level, levelBusy, onLevel: pickLevel
                  }),
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
