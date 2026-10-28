# dsh-aiignore — context noise guard for DeepSeek Harness

A Host plugin that checks a workspace **when a session opens it** and tells the
agent which files would waste its context — build output, lockfiles, logs,
huge files.

The scan is the same one the [`ai-context-doctor`](https://www.npmjs.com/package/ai-context-doctor)
CLI runs; this package only decides *when* to run it and how to phrase the
result for the model. Everything is local: no network, no API key, no upload.

## What the agent sees

When a workspace scores below the threshold, the agent receives one short note
before it starts reading files:

```text
[ai-context-doctor] This workspace scores 29/100 for context health: 71% of 1.7 MB in 24 files is likely noise.
Biggest offenders: dist/ (400.0 KB, generated build output), package-lock.json (400.0 KB, lockfile).
Suggested .aiignore: dist/, package-lock.json, *.log.
Do not read those files unless the task needs them; ask before opening large generated files.
```

Clean workspaces get no message at all — a plugin that speaks on every session
becomes noise itself.

## The panel

The bundle also ships a browser half. A folder button sits beside the add-files
button in the composer, labelled **Context** / **上下文** for screen readers.
Hovering it offers two entries, and nothing is drawn until you pick one:

- **Files** / **文件管理** — the panel opens on **the files this session touched**
  (what the agent read and what it wrote), then lets you browse the whole
  workspace a directory at a time. Every row shows the verdict before the agent
  reads anything, with the size and the token range reading it would cost.
- **Insights** / **数据分析** — the health score, the noise share, the tokens the
  guard kept out, the reads it refused and the reads it let through.

Two decisions per file, available from the tree, the session list and the report:

- **Read once** (the report calls it **Read it anyway**) pre-approves a path for
  the rest of the Host run, including one the session has not tried yet.
  Reloading the Harness forgets it — a temporary override should stay temporary.
- **Never read it** appends the path to the workspace's `.aiignore`. That is the
  durable direction, because the file is the record: it survives restarts, shows
  up in review, and you can delete the line yourself.

The panel talks to the Host half over four same-origin routes
(`GET /aiignore/report`, `GET /aiignore/tree?dir=`, `POST /aiignore/allow`,
`POST /aiignore/ignore`). They
answer for the most recently scanned workspace, never return file contents, and
set `no-store`. The Host half installs them through `ctx.inject(['webServer'])`,
so a profile without a web server still gets the read guard — it just has no panel.
There is no authentication beyond a same-origin check: like every
`ctx.webServer` route, this one inherits the loopback bind of the Harness and
must not be exposed to a network.

## Install

Through the Plugin Manager:

- **From npm** — install `dsh-aiignore`.
- **From a checkout** — install the `plugin/` directory of this repository.

Installing a local directory links it, so re-check the files directly: `files`
does not filter a linked directory.

### From the plugin market

Harness has no central store: the **Discover** tab lists whatever indexes the
user adds. This repository publishes one at

```text
https://raw.githubusercontent.com/WJDdidi-1/ai-context-doctor/main/market/index.json
```

To use it:

1. Open **Plugins** in the Web sidebar.
2. Beside **Experimental plugins**, open **More** and switch on **Custom plugin
   markets**. The Plugins page then gains an **Installed** / **Discover** split.
3. In **Discover**, add the index URL above.
4. Install **dsh-aiignore** from the result.

The Harness checks the declared `engines.dsh` range before installing and
refuses the plugin if the running version falls outside it.

## Configure

Values go in the plugin's `config` row in `cordis.patch.yml`:

```yaml
- insert:
    - id: ai-context-doctor
      name: 'dsh-aiignore'
      config:
        healthThreshold: 80
        maxFiles: 20000
        maxBytes: 268435456
```

| key | default | meaning |
| --- | --- | --- |
| `healthThreshold` | `80` | Inject only when the workspace scores below this. `100` disables the notice without uninstalling. |
| `maxFiles` | `20000` | Stop scanning after this many files. |
| `maxBytes` | `268435456` | Stop scanning after this many bytes (256 MiB). |
| `readPolicy` | `deny` | `deny` refuses `read` calls on the noisy files below; `off` only warns at session start. |

The caps exist because the scan is a synchronous directory walk: without them,
opening a huge monorepo would stall the Host.

The guard also refuses anything the workspace's own `.aiignore` lists, including
files the size heuristic considers clean. A hand-written rule beats the
heuristic, and editing the file takes effect on the next read.

## What it refuses to read

With `readPolicy: deny`, the plugin installs a tool guard that refuses `read`
calls on the same files the notice names:

| refused | why |
| --- | --- |
| `dist/`, `build/`, `coverage/`, `.next/`, `.turbo/` | generated output; the source is what matters |
| `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` | thousands of lines of resolved versions |
| `*.log` | local run output, usually stale |
| files over 1 MiB | a single read can consume the whole budget |

The refusal is a message, not a silent failure: it names the file, its size and
the tokens the read would have cost, so the agent can tell the user instead of
retrying. Templates like `.env.example` and scripts with `deploy` in the path
are **never** blocked — they are small, and a wrong guess there loses real
information.

Every refusal is recorded per workspace (`getSkippedReads`) so the UI half can
list what this session did not open.

## Limits

- The notice fires once per workspace per Host run; changing the directory in a
  session does not re-trigger it.
- The score is a size heuristic; token figures are a range from the measured
  3.08–4.32 bytes-per-token ratio, not an exact count.
- `bash`, `grep` and other tools that can read a file indirectly are not
  intercepted: the guard only sees the `read` tool.
- `.gitignore` is ignored on purpose: the point is what the agent *would* read,
  not what git tracks.
- The panel reports the last workspace scanned in this Host run. With several
  workspaces open it can trail the one you are looking at.
- Switching the interface language takes effect the next time the panel opens;
  the open panel does not re-render.
