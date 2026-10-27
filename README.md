# AI Context Doctor

[![npm](https://img.shields.io/npm/v/ai-context-doctor)](https://www.npmjs.com/package/ai-context-doctor)
[![CI](https://github.com/WJDdidi-1/ai-context-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/WJDdidi-1/ai-context-doctor/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/ai-context-doctor)](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/LICENSE)

[中文说明](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/README.zh-CN.md)

**AI coding agents read your repository file by file. Some of those files are garbage — build output, logs, lockfiles, a 40 MB data dump. This tool finds them in a few seconds and tells you what to keep away from the agent.**

```bash
npx ai-context-doctor
```

No install, no login, no API key, nothing uploaded. It only reads file names and sizes.

## What it looks like

Real output from the demo repository in this project:

```text
AI Context Doctor

Repo: demo-ai-context-noise-repo
Scanned: 8 files, 1.50 MB

AI Context Health: 22/100
Status: Too much noise for an AI coding agent

Context noise estimate:
78% likely noise
22% likely useful source context

Top context waste:
1. data/export.json            1.00 MB   large file
2. dist/                      106.9 KB   generated build output
3. package-lock.json           35.2 KB   lockfile
4. logs/dev.log                18.4 KB   local log file
5. coverage/                   16.7 KB   test coverage output

Review before sharing:
- .env.example             environment template (usually safe to share)
- scripts/deploy.sh        deployment script

Suggested .aiignore:
coverage/
dist/
*.log
package-lock.json

Next step:
Run this before asking your coding agent to inspect a larger repo.
```

## How to read it

| Line | What it means |
| --- | --- |
| `Scanned: 8 files, 1.50 MB` | What was actually walked. `.git/` and `node_modules/` are skipped. |
| `AI Context Health: 22/100` | 100 minus the share of those bytes that matched a noise rule. 22 means most of what the agent would read is noise. |
| `Status:` | Just the score in words: 85+ clean, 60–84 some noise, below 60 too much. |
| `Top context waste` | The five biggest offenders with the reason each was flagged. |
| `Review before sharing` | Files that look like credentials or deploy scripts. **The tool does not claim they are secret** — it says look before you paste the repo into a chat. |
| `Suggested .aiignore` | Lines you can paste into an ignore file. Nothing is written for you. |

## What you can do with it

- **Before you hand a repo to an agent** — run it, paste the suggested lines into `.aiignore` (or your agent's ignore setting), re-run, watch the score go up.
- **On a repo you just cloned** — see how much of it is generated output before the agent drowns in it.
- **In CI** — `--json` gives a stable object, so you can fail a build when context health drops.
- **In your own tool** — `require('ai-context-doctor')` exposes the same scan as a function.
- **Inside DeepSeek Harness** — the bundled plugin tells the agent automatically when a session opens a noisy workspace, so you do not have to remember to run it.

## Install

Run it without installing anything:

```bash
npx ai-context-doctor
```

Or install it once:

```bash
npm install -g ai-context-doctor
```

Requires Node.js 18 or newer.

## Usage

```bash
ai-context-doctor              # scan the current directory
ai-context-doctor ../some-repo # scan another repository
ai-context-doctor --json       # machine-readable output
ai-context-doctor --help
ai-context-doctor --version
```

### JSON output

```bash
npx ai-context-doctor ./some-repo --json
```

Returns `repo`, `healthScore`, `status`, `noisePercent`, `usefulPercent`, `scannedBytes`, `scannedFiles`, `topNoise`, `review`, and `suggestedAiignore` — plus `truncated: true` when a scan cap was hit.

If the path is not a readable directory, `--json` still prints a single JSON object — never a banner — and exits with code 1, so a CI step can parse the failure:

```json
{
  "error": "not-a-readable-directory",
  "message": "/path/you/passed is not a readable directory.",
  "target": "/path/you/passed"
}
```

## Use it from code

```js
const { scanRepository } = require('ai-context-doctor');

const report = scanRepository(process.cwd());
console.log(report.healthScore, report.topNoise);
```

`scanRepository(root, { maxFiles, maxBytes })` is synchronous and has no dependencies. Pass a cap for huge trees; the report then carries `truncated: true`.

## DeepSeek Harness plugin

`plugin/` packages the same scan as a Host plugin: when a session opens a workspace, the agent gets one short note about the files that would waste its context — and nothing at all when the workspace is clean. See [`plugin/README.md`](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/plugin/README.md).

## What counts as noise

- **Directories:** `dist/`, `build/`, `coverage/`, `.next/`, `.turbo/`
- **Lockfiles:** `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`
- **Logs:** `*.log`
- **Large files:** any single file over 1 MB that no more specific rule already matched
- **Review hints:** credential-shaped names (`.env*`, `secrets.env`, `credentials.json`, `*.pem`, `*.key`) and paths containing `deploy`. `.env.example` is recognised as a template and marked usually safe.
- **Never walked:** `.git/`, `node_modules/`, `.venv/`, `venv/`, `__pycache__/`, `vendor/`

## What it does not do

- It does not call an AI service, need an API key, or upload anything.
- It does not modify your repository — it never writes `.aiignore` or any other file.
- It is not a `gitignore` linter: it looks at what an agent *would read*, not what git tracks, so ignored files still show up.
- It is not a secret scanner. The review list is a name heuristic; an `id_rsa` without an extension and a key pasted into `config.js` both slip through.
- It does not count tokens or parse code. The score is a size heuristic — useful as a signal, not as a measurement.
- It does not have a config file. Caps are available through the API and the Harness plugin only.

## Why `.aiignore` and not `.gitignore`

Because the two questions are different. `dist/` is gitignored in most projects and still gets read by an agent that ignores git. The tool reports on bytes the agent would ingest, whatever git thinks of them.

## Privacy

Everything runs locally. The tool reads directory entries and file sizes; it does not read file contents, does not open a network connection, and stores nothing. The only thing it sends anywhere is what `npm` sends when you install it.

## Development

```bash
git clone https://github.com/WJDdidi-1/ai-context-doctor.git
cd ai-context-doctor
npm test                       # unit and CLI tests
node bin/ai-context-doctor.js ./demo-ai-context-noise-repo
```

The `demo-ai-context-noise-repo/` directory is a deliberately messy repository, shipped with the source (not with the npm package) to make the output easy to try.

Maintainers: see the [release checklist](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/docs/release-checklist.md). Publishing happens in CI on a `v*` tag via npm trusted publishing, and `prepublishOnly` runs the tests first, so a broken package cannot go out.

## Roadmap

- Clear errors for unknown flags instead of treating them as directory names.
- Better noise rules based on real reports from users.
- Optional `--fix` that writes the suggested ignore entries, with a diff you approve first.

## License

MIT
