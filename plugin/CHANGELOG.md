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
