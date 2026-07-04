## Verification Report: automatic-cookies-sync

### Summary
| Dimension    | Status                                   |
|--------------|-------------------------------------------|
| Completeness | 27/27 tasks, 7/7 requirements have code   |
| Correctness  | 7/7 requirements covered by tests, 1 minor gap |
| Coherence    | 1 CRITICAL (file casing), style guide otherwise followed |
| Security     | Clean (no hardcoded secrets, `npm audit` clean) |

### Issues

#### 🔴 CRITICAL (Must fix before archive)

- **Git-tracked filename case does not match the import case — breaks on any case-sensitive filesystem (Linux CI/prod).**
  Every import in the codebase references `src/credentials/firefoxSessionStore.js` (capital `S` in `Store`) — see [credentialProvider.ts:2](src/credentials/credentialProvider.ts#L2), [credentialProvider.test.ts:2,6](src/credentials/credentialProvider.test.ts#L2), [firefoxSessionStore.test.ts:9](src/credentials/firefoxSessionStore.test.ts#L9). But `git ls-tree`/`git ls-files` show the files are actually committed as `src/credentials/firefoxSessionstore.ts` and `firefoxSessionstore.test.ts` (lowercase `s`). Confirmed directly: `git cat-file -e HEAD:src/credentials/firefoxSessionStore.ts` → *"exists on disk, but not in HEAD"*; only the lowercase blob exists in the git object database.
  The commit `4c19753 "[HMB-30] rename"` only edited the import *strings* from lowercase to capital `S` — it never actually renamed the file in git's index (macOS's case-insensitive filesystem, `core.ignorecase=true` in this repo, silently absorbed a same-file "rename", so `git add` recorded no rename). Locally, on macOS, both `npm run check` and `vitest` pass because the filesystem resolves either case to the one file on disk. On a fresh `git clone` onto a case-sensitive filesystem (any standard Linux CI runner or Docker image, which is virtually every real Node deployment target), Node's ESM resolver will fail with `Cannot find module '.../firefoxSessionStore.js'` for every module that imports it (`credentialProvider.ts`, both test files) — the whole Tochka cookie pipeline, and the test suite, will not run at all.
  **Recommendation:** Fix the git-tracked name to match the imports with a two-step rename (case-insensitive filesystems require this to register): e.g. `git mv src/credentials/firefoxSessionstore.ts src/credentials/firefoxSessionStore-tmp.ts && git mv src/credentials/firefoxSessionStore-tmp.ts src/credentials/firefoxSessionStore.ts` (same for the `.test.ts` file), then commit and re-run `npm run check` on a case-sensitive checkout (or `git -c core.ignorecase=false status`) to confirm the tree and imports agree.

#### 🟡 WARNING (Should fix)

- None.

#### 🟢 SUGGESTION (Nice to fix)

- **`buildCookieHeaderForHost` is exported and unit-tested but never used in production code.** [cookieString.ts:48](src/credentials/cookieString.ts#L48) composes `selectCookiesForHost` + `dedupeCookies` + `buildCookieHeader` into one helper, but [credentialProvider.ts:48](src/credentials/credentialProvider.ts#L48) calls the three underlying functions individually instead of this helper, duplicating the composition. Recommendation: either use `buildCookieHeaderForHost` in `credentialProvider.ts`, or drop the unused helper (and its dedicated test block) to avoid dead exported surface.

### Checks Performed

- **Completeness**: All 27 tasks in `tasks.md` checked off; verified against actual code (not just checkbox state) — `src/credentials/{mozlz4,firefoxSessionStore,cookieString,credentialProvider}.ts` all exist and implement the corresponding task groups. All 7 requirements across both delta specs (`browser-cookie-source`, `secure-config-management`) have corresponding implementation.
- **Correctness**: Traced each requirement/scenario to code and tests:
  - mozLz4 decode (valid + bad signature) → [mozlz4.ts](src/credentials/mozlz4.ts), [mozlz4.test.ts](src/credentials/mozlz4.test.ts).
  - Profile priority (install-lock → legacy `Default=1` → mtime) → [firefoxSessionStore.ts:107-154](src/credentials/firefoxSessionStore.ts#L107-L154), tested including the exact "stale empty legacy default alongside real install-lock profile" scenario from `design.md` D7.
  - `recovery.jsonlz4` → `recovery.baklz4` fallback, copy-before-read → [firefoxSessionStore.ts:159-189](src/credentials/firefoxSessionStore.ts#L159-L189), tested.
  - Recursive structural cookie collection → [firefoxSessionStore.ts:196-222](src/credentials/firefoxSessionStore.ts#L196-L222), tested with nested fixture.
  - Domain filtering (`i.tochka.com`/`.tochka.com`/`tochka.com`, excludes `id.tochka.com`) + dedup by `(host, name)` → [cookieString.ts](src/credentials/cookieString.ts), tested.
  - `CredentialProvider.getSession` seam, env fallback, error when both sources are empty, cookie-name-only logging → [credentialProvider.ts](src/credentials/credentialProvider.ts), tested including a log-content assertion that the raw cookie value never appears.
  - `tochka.ts` adapter switched to `credentialProvider.getSession('tochka')` without changing the `X-CSRF-TOKEN` extraction contract → [tochka.ts:86-96](src/adapters/tochka.ts#L86-L96).
  - HM `cookie` header removal + `HM_COOKIE` no longer required → [client.ts](src/hmbee/client.ts), [env.ts](src/env.ts), tested for `confirmPlannedTransaction`/`getAllTransactions` (gap noted above for `createTransaction`).
  - One minor test-coverage gap noted above (SUGGESTION); everything else has scenario-level test coverage.
- **Coherence**:
  - `design.md` decisions (D1–D7) all match the implementation, including the specific D7 edge case (empty legacy default profile).
  - Style guide: no `any`, explicit return types on exported functions, `unknown` used for parsed sessionstore data, absolute `src/...` imports used throughout (no relative imports found), no swallowed errors without a subsequent fallback/rethrow, no one-letter variable names outside the conventional loop index `i` in `mozlz4.ts`. Tests use `mockImplementation(() => { throw ... })` for simulating a failure path, not `throw` for type-narrowing, so the testing rule is not violated.
  - `.env.example` and `README.md` correctly updated: `TOCHKA_COOKIE` re-documented as optional fallback, `HM_COOKIE` removed from both.
  - **Filename casing defect found — see CRITICAL above.**
  - Linting gates: `npm run typecheck`, `npm run lint`, `npm run check` (includes `npm run test`, 22 files / 149 tests) all pass locally on this (case-insensitive) machine.
- **Security**:
  - Searched all changed files for hardcoded secrets/tokens/cookies — only dummy test fixture values found (e.g. `super-secret-session-value` in test files), no real credentials.
  - `npm audit`: 0 vulnerabilities at any severity.

### Final Assessment

1 critical issue found (git-tracked filename case mismatch vs. import case, which will break the build/tests on any case-sensitive filesystem). Fix before archiving.
