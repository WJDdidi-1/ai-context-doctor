# Changelog

Notable changes to `ai-context-doctor`. Versions follow [SemVer](https://semver.org/).

## 0.4.0

- Add `tokenEstimate` to the report: a min/max token range derived from the
  measured 3.08–4.32 bytes-per-token ratio, never a single invented number.
- Export `classifyPath()` and `estimateTokens()` so the Harness plugin blocks
  exactly the files the report flags instead of keeping a second rule list.

## 0.3.0 — 2026-10-28

### Added

- `--write` turns the report's suggestions into `.aiignore`. It only appends:
  existing comments and rules are preserved byte for byte, and a second run
  adds nothing.
- `--write --dry-run` prints what would be added without touching the file.
- `writeAiignore()` is exported from the package for the same behaviour in code.

### Fixed

- An unknown option such as `--writ` was treated as a directory name and failed
  with "not a readable directory". It now fails with the option name and a
  pointer to `--help`.

## 0.2.2 — 2026-10-27

No runtime changes. This release exists so the npm page renders the English
README.

### Fixed

- The npm page showed the Chinese README. npm picks the readme with the glob
  `{README,README.*}` and takes the first `*.md` it sees — the filesystem order,
  not alphabetical, so `README.zh-CN.md` won. The Chinese README now lives at
  `docs/README.zh-CN.md` and is no longer shipped in the package; the English
  README is the one npm renders.

## 0.2.1 — 2026-10-27

No runtime changes. This release exists so the npm page shows the new README.

### Changed

- Both READMEs were rewritten to explain the tool in plain language: what the
  report means, line by line, and the five things a user can do with it.
  Stale facts are gone (the `0.1.x` preview label, a roadmap item asking for
  tests that already exist, an example `.aiignore` listing `*.lock` instead of
  `package-lock.json`).
- The README screenshot is removed, along with the unused image in `assets/`.

## 0.2.0 — 2026-10-27

The scanner is now a library, and the CLI is a thin printer on top of it.

### Added

- `require('ai-context-doctor')` exposes `scanRepository(root, options)` plus the
  helpers the report is built from. Callers can cap a scan with `maxFiles` /
  `maxBytes`; a capped report carries `truncated: true`.
- `npm test` runs a real unit suite (`node --test`) covering the heuristics, the
  scan totals, the truncation cap, and the CLI's text/JSON/error contracts.
- The CI `packaged` job now also imports the installed package and asserts the
  library API works from the tarball.

### Changed

- The scan moved from `bin/ai-context-doctor.js` into `lib/scan.js`; `lib/` is
  published, so the package no longer ships a CLI that requires a missing file.
- Text and JSON output are byte-for-byte identical to 0.1.1 — this release adds
  an API, it does not change the report.

## 0.1.1 — 2026-10-27

No runtime changes. This release exists so the npm page matches the repository.

### Changed

- README badges (npm version, CI, license) in both languages.
- `CHANGELOG.md` is now part of the published package.

### Infrastructure

- Releases are published by GitHub Actions through npm trusted publishing: pushing a `v*` tag runs `release.yml`, which checks the tag against `package.json`, installs the packed tarball the way a user would, publishes with a provenance attestation, and creates the GitHub release. No long-lived npm token lives in a GitHub secret.

## 0.1.0 — 2026-10-27

First public release on npm: <https://www.npmjs.com/package/ai-context-doctor>

### Fixed

- **`--json` error output is now parseable.** Error paths used to print the human banner to stdout before exiting, so `ai-context-doctor --json ./missing | jq` failed with `parse error: Invalid numeric literal at line 1, column 3`. They now emit `{"error": ..., "message": ..., "target": ...}` on stdout and exit 1, as `--json` always implied.
- **The published package would have had no executable.** npm 11 silently strips a `bin` target that starts with `./`, and it does so only on the publish path — `npm pack` and local installs stayed green, so the package would have shipped uninstallable. `bin` values no longer carry the `./` prefix, and a smoke assertion now fails the build if one reappears.

### Changed

- Install instructions lead with `npx ai-context-doctor` and `npm install -g`; the clone-and-run workflow is scoped to the bundled demo, which is not part of the published tarball.
- README images and maintainer links use absolute URLs so they resolve on the npm page.
- `--json` is documented in both READMEs, including the error contract.
- `prepublishOnly` runs the smoke suite.

### Added

- Smoke coverage for the JSON error contract, secret-name heuristics, and `bin` target validity.

## Earlier

`v0.1.0 – first usable local CLI prototype` (April 2026) was a pre-release of a local-only prototype, never published to npm. Its tag now points at the 0.1.0 release commit.
