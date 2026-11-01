## 0.7.4

- **`--json` now reports the strength it scored at.** The output carried the
  score but not the policy behind it, so two runs could differ because the code
  changed or because the strength did, with nothing in the file to tell them
  apart. It now includes `strength` and `strengthLabel`, and documents
  `blockedFiles` / `blockedBytes`, which were emitted but unlisted.

## 0.7.3

- **Fix: `--write` wrote through a dangling `.aiignore` symlink.** The guard
  checked `fs.existsSync` before `lstat`, and `existsSync` follows the link — so
  for a symlink whose target did not exist it returned `false`, the guard was
  skipped, and `writeFileSync` created the link's target. It now `lstat`s in a
  try/catch, which is the question the guard was asking all along, and refuses
  with exit 1. The README promised this; the code did not.

# Changelog

Notable changes to `ai-context-doctor`. Versions follow [SemVer](https://semver.org/).

## 0.7.2

- **Fix: `.aiignore` rules never changed a score.** `parseRules` returns a
  `Set`, and the scanner only accepted an `Array` — so every rule the panel
  wrote was dropped before scoring, and `effectiveScore` moved only with the
  strength. This is why Optimize could report "4 rules added" and leave the
  number where it was.
- **Fix: with an array of rules, every file was blocked.** `matchesAiignore`
  returns the matched rule's text (or `undefined`), and the caller compared it
  to `null`, which is always true. One rule meant the whole folder counted as
  handled.
- `blockedBytes` now means what `blockedFiles` means: every byte the policy
  keeps out, not only the noise entries. A 300 KB file refused for its size was
  counted as blocked but reported as zero bytes.

## 0.7.1

- Add `scanLevels(root, { levels })`: the same reports for several strengths
  from **one** directory walk. The panel shows all five strengths at once and
  used to read the whole tree once per strength — 44 ms became 9 ms on a
  1,500-file folder. Each preview is byte-for-byte what `scanRepository` returns
  for that strength, which the tests assert level by level.

## 0.7.0

- Score a repository on five dimensions instead of one, because "no noise" was
  standing in for "nothing wrong". `noise` (30) is the part rules can move;
  `volume` (25), `concentration` (20), `sprawl` (15) and `binary` (10) describe
  the folder itself and no `.aiignore` rule can change them. A folder that is
  clean but 400 MB of source now scores honestly instead of 100.
- Every dimension is capped at its weight and reported in `scoreBreakdown` as
  `{ id, label, hint, weight, lost, points, bytes, detail }`. Concentration and
  binaries only count once a folder passes 256 KB, so a three-file fixture is
  not punished for being small.
- `effectiveScore` now runs the same model over the subset that rules and
  strength let through, so it can no longer be 100 for every strength level.
  Reports add `allowedFiles`, `allowedBytes`, `blockedFiles`, `largestBytes`
  and `binaryBytes`.
- `scanRepository` reads `.aiignore` and `.aiignore.policy.json` when it is
  given a `rules`/`level`, so the number in the CLI is the number the guard
  will enforce.
- The CLI prints `What reaches the model`, the strength line and a per-dimension
  breakdown under `Where the points go`.
- `readPolicy`, `writePolicy`, `POLICY_FILE`, `contextScore`, `DIMENSIONS` and
  `isBinaryPath` are exported.

## 0.6.1

- Licence from MIT to Apache-2.0, with a `NOTICE` file. The patent grant and
  the trademark clause are worth more to the people depending on this than the
  brevity of MIT is. Releases up to 0.6.0 keep their MIT terms.
- No functional change: `scanRepository`, the CLI output and the JSON contract
  are byte-for-byte what 0.6.0 shipped.

## 0.6.0

- Score the repository as four independent losses instead of one byte ratio:
  build output (weight 40), large files (25), lockfiles (20), logs (15). A
  category costs `weight × its share of bytes`, capped at its weight, so a
  single 40 MB `dist/` now costs 40 points rather than ~98. `healthScore` can
  therefore be higher than before for the same repository — this is a
  deliberate change, and `scoreBreakdown` shows the arithmetic.
- Add `scoreNoise()`, `noiseCategory()` and `CATEGORY_WEIGHTS` for callers that
  want to explain a score instead of only printing it.
- Add `lib/levels.js`: five filtering levels (`off`, `light`, `balanced`,
  `strong`, `strict`) as data, with `DEFAULT_LEVEL = 3` and a consequence
  sentence per level. The Harness plugin drives its slider from this.

## 0.5.0

- Export `matchesAiignore()` and `parseRules()`: the guard in the Harness plugin
  now refuses the paths a workspace's own `.aiignore` lists, including files the
  size heuristic considers clean. A hand-written rule beats the heuristic.
- The matcher implements a small gitignore subset — comments, trailing `/` for
  directories, `*` within a segment, `**` across segments — and never throws on
  a rule it does not understand.

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
