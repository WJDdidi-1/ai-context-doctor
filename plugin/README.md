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

## Install

Through the Plugin Manager:

- **From npm** — install `dsh-aiignore` (this name lands on the registry with
  the rename; until then install the `plugin/` directory below).
- **From a checkout** — install the `plugin/` directory of this repository.

Installing a local directory links it, so re-check the files directly: `files`
does not filter a linked directory.

### From the plugin market

> **Paused during the rename.** The published index still lists the previous
> package name, `dsh-plugin-ai-context-doctor@0.1.1`, because that is what is
> actually on the registry. It keeps working; the index is repointed when
> `dsh-aiignore` is published.

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
4. Install **AI Context Doctor** from the result.

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

The caps exist because the scan is a synchronous directory walk: without them,
opening a huge monorepo would stall the Host.

## Limits

- The notice fires once per workspace per Host run; changing the directory in a
  session does not re-trigger it.
- The score is a size heuristic, not a token count or a security audit.
- `.gitignore` is ignored on purpose: the point is what the agent *would* read,
  not what git tracks.
