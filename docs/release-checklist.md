# Release Checklist

Maintainer-only checklist before publishing to npm.

1. Run the smoke check:

   ```bash
   npm run smoke
   ```

2. Check the package contents:

   ```bash
   npm run pack:check
   ```

3. Confirm the npm package name and publishing account permissions.
4. Confirm 2FA and publish permissions.
5. Run the real publish only after the checks above are clean:

   ```bash
   npm publish
   ```
