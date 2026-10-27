# Changelog

Notable changes to `ai-context-doctor`. Versions follow [SemVer](https://semver.org/).

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
