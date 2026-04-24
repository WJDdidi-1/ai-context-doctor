# AI Context Doctor

Find what your AI coding agent should not read.

AI Context Doctor is a local CLI that scans your repository and shows which files are likely wasting context before you use Claude Code, Codex, Cursor, Cline, or another repo-aware coding agent.

```bash
npx ai-context-doctor
```

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
Create a small .aiignore before asking your coding agent to inspect this repo.
```

No login. No API key. No files uploaded.

Use it before sending your repo to an AI coding agent.

## Run locally

```bash
node bin/ai-context-doctor.js
npm start
```

This early prototype uses simple file and directory heuristics. It does not call an AI API, upload files, or modify your repository.

## GitHub description

Find the files your AI coding agent should not read before sending it your repo.

## Why use it

AI coding tools work better when they read the right files. Real repositories often include generated output, caches, logs, lockfiles, coverage reports, and other files that add noise before the agent reaches the source code that matters.

AI Context Doctor is meant to make that noise visible in a few seconds.

## MVP scope

The first MVP should stay small:

- Scan the current repository from the command line.
- Detect common context noise such as build output, caches, coverage, logs, lockfiles, and large generated files.
- Show a simple AI Context Health score.
- List the top files or directories likely wasting context.
- Suggest a starter `.aiignore`.
- Print a screenshot-friendly terminal report.
- Run locally without login, API keys, or file uploads.

The first version should prioritize JavaScript and TypeScript repositories while keeping the rules general enough to support other stacks later.

## Non-goals

This project should not become a large platform in the first version.

- Not a security scanner.
- Not a vulnerability detector.
- Not an AI API wrapper.
- Not a SaaS dashboard.
- Not an account-based product.
- Not a code quality analyzer.
- Not a complex AST analysis tool.
- Not an automatic file modifier.
- Not a replacement for `.gitignore`.

Potentially sensitive files may be highlighted for review, but the project should avoid making heavy security claims.

## Status

This repository now contains a minimal runnable CLI prototype. The next step is to keep improving scanning rules in small, reviewable iterations.
