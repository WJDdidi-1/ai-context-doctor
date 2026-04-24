# AI Context Doctor

[中文说明](./README.zh-CN.md)

Find what your AI coding agent should not read.

AI Context Doctor is an early usable local CLI prototype that scans a repository and shows files that are likely wasting context before you use Claude Code, Codex, Cursor, Cline, or another repo-aware coding agent.

## Current status

AI Context Doctor currently runs as a local Node.js CLI from this repository.

- Usable today: clone the repo and run it with `node`.
- Not published yet: `npx ai-context-doctor` is a future npm goal, not the current install path.
- No login, API key, or file upload is required.
- Results are heuristic, not precise token accounting or security analysis.

## Quick start

Clone the repository and run the local CLI:

```bash
git clone https://github.com/WJDdidi-1/ai-context-doctor.git
cd ai-context-doctor
node bin/ai-context-doctor.js
```

## Scan Current Directory

```bash
node bin/ai-context-doctor.js
```

## Scan Another Directory

```bash
node bin/ai-context-doctor.js ../some-repo
```

## Example Output

```text
AI Context Doctor

Repo: my-project
Scanned: 428 files, 31.6 MB

AI Context Health: 62/100
Status: Too much noise for an AI coding agent

Context noise estimate:
73% likely noise
27% likely useful source context

Top context waste:
1. dist/                  18.4 MB   generated build output
2. package-lock.json       1.9 MB   lockfile
3. coverage/               1.2 MB   test coverage output
4. .next/cache/            980 KB   framework cache
5. logs/dev.log            420 KB   local log file

Review before sharing:
- .env.example             environment-like file
- scripts/deploy.sh        deployment script

Suggested .aiignore:
dist/
coverage/
.next/cache/
*.log
*.lock
.env*

Next step:
Run this before asking your coding agent to inspect a larger repo.
```

## What It Does Now

- Scans the current working directory or one directory path you pass in.
- Detects common context noise such as build output, framework caches, coverage output, lockfiles, and log files.
- Highlights environment-like files and deployment scripts for review before sharing.
- Prints a screenshot-friendly terminal report.
- Suggests starter `.aiignore` entries based on simple heuristics.

## What It Does Not Do

- It does not call an AI API.
- It does not upload files.
- It does not modify your repository.
- It does not generate `.aiignore` automatically.
- It does not provide JSON output or a configuration system.
- It is not a security scanner or vulnerability detector.
- It does not perform precise token counting or AST analysis.

## Why It Exists

AI coding tools work better when they read the right files. Real repositories often include generated output, caches, logs, lockfiles, coverage reports, and other files that add noise before the agent reaches the source code that matters.

AI Context Doctor is meant to make that noise visible in a few seconds, before you send a repository to an AI coding agent.

## Current Heuristics And Limits

Current noise rules are intentionally simple:

- Directories: `dist/`, `build/`, `coverage/`, `.next/`, `.turbo/`
- Lockfiles: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`
- Logs: `*.log`
- Review hints: `.env*` files and paths containing `deploy`
- Skipped traversal: `.git/` and `node_modules/`

The health score and noise percentage are rough estimates based on matched file sizes. They should be treated as a quick signal, not an exact measurement.

## Future npm usage

The package is not published to npm yet. The intended future usage is:

```bash
npx ai-context-doctor
```

Until then, use the local `node bin/ai-context-doctor.js` workflow shown above.

## Roadmap

Near-term next steps:

- Keep scanning rules small and explainable.
- Add a minimal smoke test before npm release.
- Prepare the first npm publish once metadata and docs are ready.

## Privacy

AI Context Doctor runs locally. It does not require login, does not need an API key, does not call an AI service, and does not upload files.
