## 0.19.0

The unit of analysis is the conversation, not the folder.

- **A Chat tab, and it comes first.** The panel reads the app's own session
  projection (`storages/session_projcache/sessions/<id>.json`) instead of
  guessing from folder scans: the conversation's title, its folder, how many
  turns it has run, how many files it read, and how those bytes split across
  assistant / tool / user / injected context. The score is computed from what
  *this conversation* read — `scoreNoise` over the bytes it pulled in — so a
  chat that never touched a build artefact scores 100 even in a noisy repo.
- **Switching conversations is a control, not a guess.** The tab carries a
  conversation picker built from `GET /aiignore/sessions`; `GET
  /aiignore/conversation?session=` answers for any of them. Choosing *Follow the
  open conversation* hands the decision back to the Host half.
- **Optimize is scoped to the conversation, and it re-scores.** *Optimize this
  conversation* sends `{ session }`, writes the rules derived from that
  conversation's noise reads, then reports the workspace score before/after and
  — the check that matters — how many of those reads the new rules would now
  block. Undo still lives in the Score tab.
- **Insights is now Score.** The tab is the workspace score, its arithmetic, and
  the guard's record; calling it *Insights* made it sound like a different
  subject from the number it explains.
- Seventeen same-origin routes (was sixteen).

## 0.18.0

The score explains itself, the policy is one slider, and a suggestion can be applied.

- **Following is by conversation, not by folder.** The Host half reads the first
  zstd frame of the newest session log — a JSON header carrying the session id
  and its `cwd` — so identity no longer depends on the workspace index. It used
  to fall back to "the most recently updated workspace", which is why the panel
  kept following the first folder it saw. `GET /aiignore/sessions` lists recent
  conversations, each with its own folder.
- **The score shows its arithmetic.** Insights draws one bar per category: what
  it cost, out of the weight it could cost, with the total on the header and one
  sentence for the rule. These are the numbers `scanRepository` computed; the
  panel does not re-derive them.
- **One click to optimize.** *Optimize this workspace* appends the suggested
  rules to `.aiignore` (existing lines untouched), reports the score before and
  after, and keeps the previous file for **Undo**. Both live at
  `POST /aiignore/optimize` and `POST /aiignore/optimize/undo`.
- **The note is no longer the whole strategy.** *Note* became *Strategy*: a
  five-notch slider from Off to Strict, each notch stating what it stops and what
  that costs, stored in `.aiignore.policy.json` and honoured by the read guard
  itself (`decideRead({ level })`). The free-text note stays underneath, where it
  belongs. Notches 4 and 5 warn that small but real source files can be skipped.
- **New routes** — `GET /aiignore/sessions`, `GET|POST /aiignore/policy`,
  `POST /aiignore/optimize`, `POST /aiignore/optimize/undo` (sixteen in total).
- Requires `ai-context-doctor@^0.6.0`: weighted scoring, `scoreBreakdown`, and
  the level table the slider shows come from the library.

## 0.17.0

The panel stopped asking which folder to audit. It reads the conversation.

- **Follows the conversation, by default.** The Host half finds the session whose
  log was written last under `~/.dsh/sessions`, maps it to a folder through
  `~/.dsh/storages/workspace.json`, and scans that. Opening a conversation is the
  whole interaction; the "No workspace yet" dead end is gone for good.
- **Pinning is reversible.** The folder button now opens a menu: follow the
  conversation, choose another folder, or stop pinning. Pinning only lasts as
  long as the panel is open — nothing is written to disk.
- **The aggregate view moved where it belongs.** *Context across your workspaces*
  is a page in the left rail, under New Session: every folder this app has been
  used in, ranked by health, so a noisy repository is visible before you open it.
  It is cached for five minutes (`GET /aiignore/overview`).
- **Faithful preview.** `dev/preview.html` now mounts the rail icon and the
  overview page too, and a request that names its folder wins, exactly like the
  Host half — that is what makes "stop pinning" observable without a restart.

## 0.16.0


- **The panel can no longer dead-end.** When it cannot tell which folder the
  conversation runs in — the case that left 0.14.0 and 0.15.0 showing "No
  workspace yet" — it now lists the folders this app has actually been used in
  and opening one scans it. `GET /aiignore/workspaces` reads them from the app's
  own workspace store.
- **A mismatch leaves evidence.** `POST /aiignore/client-report` records what the
  Host handed the panel (which props, whether a session came with them);
  `GET /aiignore/debug` reads it back next to the Host's own state, so the next
  disagreement is one request away instead of a round of guessing.
- The header no longer repeats "No workspace yet"; the body says it once.

## 0.15.0

The panel now tells the Host which conversation it belongs to.

- **Fixed: Scan still answered "no workspace" after 0.14.0.** Asking
  `ctx.agents.list()` and `ctx.sessions.list()` did not produce a directory in a
  real profile, so the panel had nothing to scan. The slot body is rendered with
  its `sessionId` and a `useSessions` selector — a fact only the conversation
  itself holds — so the panel now reads its session's `cwd` and passes it to the
  Host as `?cwd=`, on the report, the tree and the scan.
- The Host half accepts that directory only when it is an absolute path to an
  existing directory; anything else is ignored and the previous fallbacks
  (registries, then the last scanned workspace) still apply.
- Reads now refuse a cross-origin caller with 403, not just writes.

## 0.14.0

The panel now finds its workspace instead of waiting to be told about it.

- **Fixed: the panel could sit on "no workspace" forever.** The workspace was
  learned only from the `agent/created` event. A bundle can be applied on a
  branch of the context tree that never hears that event, and a session that
  already existed when the bundle was installed never announces itself again.
  The Host half now also asks `ctx.agents.list()` and `ctx.sessions.list()` for
  the newest conversation directory, so the report appears either way.
- **Scan this conversation.** The empty panel is no longer a dead end: a button
  rescans the current conversation's workspace on demand and re-reads the tree
  each time, so the numbers are fresh rather than replayed.
- **The three views are always visible.** The Files / Insights / Note tabs used
  to disappear when no workspace had been found yet, which made the panel look
  like one blank screen. Each view now has its own empty state under a tab bar
  that never vanishes.
- `POST /aiignore/scan` is the eighth route: same-origin only, answers 404 when
  the conversation has no directory yet.

## 0.13.0

The file list behaves like a file list, and a decision can be taken back.

- **Multi-select.** Click selects one row, Cmd/Ctrl-click toggles a row, Shift-click
  selects a range; with more than one selected the toolbar offers "Never read N
  files" and "Clear". Batch ignore posts one rule at a time, so a failure stops
  where it happened instead of half-writing a list.
- **Undo.** After a file is written into `.aiignore` the panel shows what it did
  and offers Undo, which calls `POST /aiignore/unignore` — a route that removes
  exactly that one rule line and leaves every other line (and comment) untouched.
  A symlink, a directory, or a missing file is refused rather than rewritten.
- **Sort.** "Largest first" (the default — the biggest files waste the most
  context) or "Name"; folders always stay above files.

## 0.12.0

Three things the panel could describe but not do.

- **Uploads are visible.** Images the user dropped into the composer appear as
  thumbnails, grouped by day (Today / Yesterday / date), newest first. The route
  behind them (`GET /aiignore/upload?digest=`) serves only content inside the
  attachment store, only image types, re-checked against the digest — and it
  answers 404 for anything that is not a 64-hex digest.
- **A note can start from a template.** Three one-click starting points (entry
  point, what to skip, how to check) insert a sentence into the note instead of
  making the user write it from scratch; the note still round-trips through
  `.aiignore.notes.md` as before.
- **The report can leave the window.** "Export report (.md)" writes a Markdown
  copy of the current report — refused reads, reads, session files, uploads and
  the note — through a client-side download, so nothing new needs to be served.
- The browser half now declares named regions (`copy`, `styles`, `helpers`,
  `components`, `views`, `shell`, `registration`). It ships as a single file
  because the Harness loads it with `__ModuleLoader__.load({ factory })` and
  there is no build step; a test keeps the regions in order and bounded.

## 0.11.0

The panel moved out of a floating box and into the right sidebar, and it now
looks like the rest of the app instead of like a widget.

- **The report is a sidebar tab.** The folder button in the composer opens the
  right sidebar on the tab (and expands the sidebar if it is collapsed). When a
  host has no sidebar services, the button falls back to the old floating panel,
  so one plugin still works on both.
- **Three tabs: Files, Insights, Note.** Files decides what may be read,
  Insights reports what was read, Note is the message to the agent.
- **Styled from the Host's design tokens.** Every color, radius, shadow and font
  comes from `--dsw-*` variables with a fallback, so light and dark themes both
  look right; the old hard-coded dark palette is gone.
- Type hierarchy instead of one 12px size: 11px section labels, 13px rows,
  20px figures with tabular numerals.
- Icons are 14px line icons drawn inline; status shows as an icon plus a word,
  not as a color dot alone.
- Search, the four filter chips, the session file list, the breadcrumb and the
  detail card all work from the keyboard: `Tab` reaches every control, `Enter`
  activates, focus rings come from the Host.
- Empty, loading and error states are real screens: a skeleton while the first
  report loads, a centered empty state, and an error state with a human sentence
  and a retry button.
- The panel no longer repeats its own title — the tab title carries it.
- `plugin/dev/preview.html` renders the panel against the Host's real tokens
  with mock data, in both themes, without a Harness running. It is a development
  page and is not part of the published package.
- Guarded registration: a host without slots, without a sidebar, or with
  services that mount late loads the plugin instead of failing.

## 0.10.0

- Files you upload during a session now appear in **Insights**, under "Files
  received this session". The Host stores uploads by content digest and drops
  the original name, so the row shows the digest prefix, the size and a type
  guessed from the magic bytes — not a filename.
- **Insights** gains a note field: write what the agent should know about this
  workspace, and it is saved to `.aiignore.notes.md` and pushed to the running
  agent immediately. The next session picks it up on its own.
- An empty note deletes the file rather than leaving a blank one.

## 0.9.0

- The folder button now opens a menu with two entries, **Files** and
  **Insights**, instead of a single panel. Files is where you decide what may be
  read; Insights is the report that used to be the whole panel.
- The Files view opens with **the files this session touched** — everything the
  agent read and everything it wrote — so the panel is useful before anything
  has been refused. It still browses the whole workspace underneath.
- The Host half records write and edit tool calls, so files the agent created
  appear in that list even when no read was ever blocked.
- The panel no longer prints its own title twice.

## 0.8.0

The panel was a report. It is now a file manager: the workspace is browsable one
directory at a time, and every row carries the scanner's verdict before the agent
tries to read anything.

- `GET /aiignore/tree?dir=` serves one directory with the same classification the
  guard uses, so the tree and the report can never disagree. Paths outside the
  workspace are refused with `400 outside-workspace`.
- Folders sort first, files by size. Each row shows the verdict, its size, and for
  files the token range reading it would cost; hidden `.git` entries are skipped.
- Selecting a file opens a detail pane with two decisions: **Read once**
  (pre-approves a path the session has not tried yet) and **Never read it**
  (appends it to `.aiignore`).
- A directory listing is capped at 200 rows and says so, so a huge folder cannot
  stall the panel.

# Changelog

Notable changes to the `dsh-aiignore` plugin package. The CLI package keeps its own
[changelog](../CHANGELOG.md).

## 0.7.0

The panel existed but was unreachable: the button rendered, and clicking it showed
`title` and `allowFailed` instead of a report. Both causes were missing declarations,
and both failed silently.

- The browser half declared `inject: ['slots']`, so `ctx.locale` was undefined and
  every label fell back to its raw key. It now declares `locale` too.
- The Host half read `ctx.webServer` at apply time without asking cordis to wait for
  it, so the report routes were never registered and every request answered 404 —
  which the panel then reported as `allowFailed`. `tools` and `webServer` are now
  installed through `ctx.inject`: a late-mounting service still gets its guard and
  its routes, and a headless profile keeps the guard without a web server.
- The button moved to `conversation.input.left`, the row that holds the add-files
  button, and renders a folder glyph instead of the word "button".

## 0.6.0

- The guard reads the workspace `.aiignore`; a rule there refuses a file the size
  and type heuristics would have passed.
- The panel can write a decision back: "Never read it" appends the path to
  `.aiignore`, so the choice survives a restart and lands in review.

## 0.5.0

- Every read inside the workspace is recorded, so the panel shows what the session
  spent as well as what it kept out.

## 0.4.0

- First browser half: a button in the composer dock and a panel that opens on click,
  served by two same-origin routes.
