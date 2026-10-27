# Release Checklist

Maintainer-only checklist before publishing to npm.

1. Publish from `main` with a clean working tree. A dirty tree publishes whatever is on disk, not what is on GitHub:

   ```bash
   git status --short
   ```

2. Run the smoke check:

   ```bash
   npm run smoke
   ```

3. Check the package contents. `bin/` must be present and the version must be the one you intend to release:

   ```bash
   npm run pack:check
   ```

4. Install the packed tarball into a temporary directory and run the CLI. This catches a file that exists in the repository but is missing from `files`:

   ```bash
   npm pack
   mkdir -p /tmp/aicd-release-check && cd /tmp/aicd-release-check
   npm install --no-audit --no-fund "$OLDPWD"/ai-context-doctor-*.tgz
   ./node_modules/.bin/ai-context-doctor .
   ```

5. Confirm the npm package name and publishing account permissions.
6. Confirm 2FA and publish permissions.
7. Run the real publish only after the checks above are clean. `publish` runs `prepublishOnly`, which repeats the smoke check:

   ```bash
   npm publish
   ```

8. Verify the published result:

   ```bash
   npm view ai-context-doctor version
   npx ai-context-doctor@latest --version
   ```
