# Token estimation: measurements and decision

Measured with `tiktoken` (`o200k_base`) on real files in this repository.

| File | Bytes | Tokens | Bytes/token |
|---|---:|---:|---:|
| `bin/ai-context-doctor.js` (source) | 8310 | 2137 | 3.89 |
| `scripts/smoke-test.js` (source) | 4044 | 957 | 4.23 |
| `README.md` (prose + code) | 6204 | 1435 | 4.32 |
| `package-lock.json` (lockfile) | 36036 | 11035 | 3.27 |
| `export.json` (JSON data) | 1052013 | 258414 | 4.07 |
| `dev.log` (log) | 18820 | 6120 | 3.08 |
| `app.bundle.js` (build bundle) | 109494 | 28805 | 3.80 |

## Findings

- The tiktoken README says that on average "each token corresponds to about 4 bytes" for general text. That is an average, not a constant.
- Measured ratios range from 3.08 to 4.32, a spread of roughly 30%. A fixed `bytes / 4` is not reliable for every file type.
- Logs and lockfiles are the most token-dense (ratio around 3.1 to 3.3). A byte-based noise share therefore **underestimates** the token share of those files.

## Decision

- Keep the byte-based metric as the primary signal, and label it clearly as a byte share.
- Do not present any byte or token figure as real model cost or as the exact token count for a specific model.
- If a token estimate is added later, present it as an approximation with a stated error range, and keep it separate from the byte share.

## Limits

- Measured on a small set of files, not a statistically representative corpus.
- The tokenizer used is OpenAI's. Other model families tokenize differently.
