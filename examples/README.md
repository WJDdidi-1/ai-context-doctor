# Examples

Each example is a small, runnable Node.js script. They use only the code in this repository and Node.js built-ins, so there is no install step and no network access.

## Explain why a path is blocked

[`explain-blocked-path.js`](explain-blocked-path.js) exercises the same code path as `ai-context-doctor --explain`. It builds a throwaway repository in the OS temp directory, runs the real CLI twice, and removes the fixture afterwards.

```bash
node examples/explain-blocked-path.js
# or
npm run example
```

The first run has no `.aiignore`; the lockfile is blocked by the default strength 3 (Balanced):

```text
AI Context Doctor — runnable --explain example

The fixture is a throwaway repository with one source file and one lockfile.

1. With no .aiignore, the default strength decides:

$ ai-context-doctor --explain package-lock.json

AI Context Doctor — explain

Path: package-lock.json
Verdict: blocked
Rule: strength 3 (Balanced) skips lockfiles
Category: lockfile
Size: 363 B (~84–118 tokens)
Why: lockfile
Score impact: allowing it would cost 21 points (100/100 -> 79/100).

2. After adding "src/index.js" to .aiignore, the exact rule is reported:

$ ai-context-doctor --explain src/index.js

AI Context Doctor — explain

Path: src/index.js
Verdict: blocked
Rule: .aiignore rule "src/index.js"
Category: none (not context noise)
Size: 59 B (~14–19 tokens)
Why: ordinary source file
Score impact: allowing it would not change what reaches the model (100/100).

Both runs call the same classification, rule matching and strength checks that the scan and the Harness panel use.
```

The script asserts those stable lines before it exits, so if the output stops matching this walkthrough it fails instead of printing stale instructions. `--json` works too: add it before `--explain` to get the same explanation as an object.
