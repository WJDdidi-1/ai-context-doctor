# AI Context Doctor

[中文说明](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/README.zh-CN.md)

Find what your AI coding agent should not read.

AI Context Doctor is an early preview of a local CLI that scans a repository and shows files that are likely wasting context before you use Claude Code, Codex, Cursor, Cline, or another repo-aware coding agent.

Demo output from `ai-context-doctor ./demo-ai-context-noise-repo` inside a clone of this repository:

![AI Context Doctor demo output showing context health, top context waste, review hints, and .aiignore suggestions](https://raw.githubusercontent.com/WJDdidi-1/ai-context-doctor/main/assets/ai-context-doctor-demo-output.png)

## Current status

AI Context Doctor is published on npm as an early preview (`0.1.x`).

- Run it without cloning: `npx ai-context-doctor`.
- No login, API key, or file upload is required.
- Results are heuristic, not precise token accounting or security analysis.
- The rule set is intentionally small; treat the score as a quick signal, not a measurement.

## Quick start

Scan the repository you are standing in:

```bash
npx ai-context-doctor
```

Scan another local repository:

```bash
npx ai-context-doctor ../some-repo
```

If you would rather install it once than download it per run:

```bash
npm install -g ai-context-doctor
```

### Try the bundled demo

The demo repository ships with the source, not with the npm package. Clone it if you want to see the tool run on a repository built to be noisy:

```bash
git clone https://github.com/WJDdidi-1/ai-context-doctor.git
cd ai-context-doctor
node bin/ai-context-doctor.js ./demo-ai-context-noise-repo
```

## Scan Current Directory

```bash
npx ai-context-doctor
```

## Scan Another Directory

```bash
npx ai-context-doctor ../some-repo
```

## CLI Help

```bash
npx ai-context-doctor --help
npx ai-context-doctor --version
```

## JSON Output

Use `--json` to get the report as machine-readable JSON, for scripts or CI:

```bash
npx ai-context-doctor ./some-repo --json
```

The JSON includes `healthScore`, `noisePercent`, `topNoise`, `review`, and `suggestedAiignore`.

If the target is not a readable directory, `--json` still writes a single JSON object to stdout and exits with code 1, so a CI step can parse the failure:

```json
{
  "error": "not-a-readable-directory",
  "message": "/path/you/passed is not a readable directory.",
  "target": "/path/you/passed"
}
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
2. data/export.json        2.4 MB   large file
3. package-lock.json       1.9 MB   lockfile
4. coverage/               1.2 MB   test coverage output
5. logs/dev.log            420 KB   local log file

Review before sharing:
- .env.example             environment template (usually safe to share)
- scripts/deploy.sh        deployment script

Suggested .aiignore:
dist/
coverage/
*.log
package-lock.json
.env*

Next step:
Run this before asking your coding agent to inspect a larger repo.
```

The score in this example is illustrative. Run the tool on your own repository to get your real numbers.

## From Report To Action

The tool only reports. It does not write files, and it does not know how your coding agent reads ignore rules. To act on the suggestions:

1. Review the "Review before sharing" list yourself. Check those files before you share the repository.
2. If you want to keep the suggested paths out of your agent's context, add them to the ignore file that your tool supports (for example `.gitignore` or your agent's own ignore setting). Check that tool's documentation to confirm which file it reads.
3. Re-run the report to confirm the noise estimate went down.

Treat the suggested `.aiignore` entries as a starting point, not a verified configuration.

## What It Does Now

- Scans the current working directory or one directory path you pass in.
- Detects common context noise such as build output, framework caches, coverage output, lockfiles, log files, and individual files over 1 MB.
- Highlights environment-like files and deployment scripts for review before sharing.
- Prints a screenshot-friendly terminal report.
- Suggests starter `.aiignore` entries based on simple heuristics.

## What It Does Not Do

- It does not call an AI API.
- It does not upload files.
- It does not modify your repository.
- It does not generate `.aiignore` automatically.
- It does not provide a configuration system.
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
- Large files: individual files over 1 MB, unless a more specific rule already matched
- Review hints: credential-style file names such as `.env*`, `secrets.env`, `credentials.json`, `*.pem`, and `*.key`; template files like `.env.example` are noted as usually safe; paths containing `deploy`
- Not detected: extensionless private keys (for example `id_rsa`) and secrets inside ordinary files. The review list is a naming heuristic, not a secret scanner.
- Skipped traversal: `.git/`, `node_modules/`, `.venv/`, `venv/`, `__pycache__/`, and `vendor/`

The health score and noise percentage are rough estimates based on matched file sizes. They should be treated as a quick signal, not an exact measurement.

## Maintainer Notes

Maintainers can use the short [release checklist](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/docs/release-checklist.md) before publishing. `npm publish` runs the smoke check first through `prepublishOnly`, so a broken package cannot be published by accident.

## Roadmap

Near-term next steps:

- Keep scanning rules small and explainable.
- Add unit tests for the rule helpers and run them in CI.
- Improve how accurately the noise estimate reflects real repositories, based on user feedback.

## Privacy

AI Context Doctor runs locally. It does not require login, does not need an API key, does not call an AI service, and does not upload files.
