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
