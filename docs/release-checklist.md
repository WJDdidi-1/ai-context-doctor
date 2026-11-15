# Release Checklist

Releases are published by GitHub Actions through [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
There is no token in a secret and no 2FA prompt: GitHub mints a short-lived OIDC token for the
run, npm verifies it came from this repository's `release.yml`, and the tarball is signed with a
provenance attestation.

**So a release is a tag push.** Nothing is published from a laptop.

## Cutting a release

1. Bump the version on `main` and open a PR. Get CI green and merge.

   ```bash
   npm version patch --no-git-tag-version   # or minor / major
   ```

2. Tag the merge commit — the version in `package.json` and the tag must agree, or the release
   workflow stops before publishing:

   ```bash
   git tag -a v0.1.1 -m "ai-context-doctor 0.1.1"
   git push origin v0.1.1
   ```

3. Watch the run: `gh run watch`. It checks the tag against `package.json`, installs the packed
   tarball the way a user would, publishes, and creates the GitHub release.

4. Verify the result the same way a stranger would:

   ```bash
   npm view ai-context-doctor version
   npx ai-context-doctor@latest --version
   ```

## One-time setup (already done for this package)

- On npmjs.com → package → **Settings** → **Trusted Publisher** → GitHub Actions, with:
  - Organization or user: `WJDdidi-1`
  - Repository: `ai-context-doctor`
  - Workflow filename: `release.yml`
  - Environment: *(empty)*

  Equivalent from the CLI, authenticated as a maintainer:

  ```bash
  npm trust github ai-context-doctor --file release.yml --repo WJDdidi-1/ai-context-doctor -y
  ```

- `npm trust list ai-context-doctor` prints the configured relationships.
- The workflow needs `id-token: write`; it deliberately does **not** read `NODE_AUTH_TOKEN`.

## Before publishing anything

1. Confirm the working tree is clean — CI publishes what is committed, never what is on disk.
2. `npm run smoke` and `npm run pack:check` (both run in CI too).
3. Confirm `files` still lists every directory the CLI `require`s. `bin/ai-context-doctor.js`
   already depends on `../lib/rules.js`, so `lib/` must stay in `files`.

## If a release goes wrong

- The version number is spent once published. Fix forward with the next patch version; do not
  force-push a tag that has already produced a publish.
- `npm unpublish` is deliberately hard for anyone holding a bypass-2FA token, and it is not part
  of this workflow. Prefer `npm deprecate` to warn users off a bad version.
