# Code Review — apply-block-unresolved

**Scope:** `src/apply/index.ts`, `src/apply/preview/tochka.ts`, `src/hmbee/skipIndex.ts`, `src/index.ts`, `src/apply.test.ts` (files touched by this change, per `git diff master...HEAD`).

**Quality gate status:** `npm run typecheck` clean, `npx vitest run` 170/170 passing, `npx biome check` on the five changed files clean. `npm run check`'s lint step fails only on `config/sources.json` (untracked/gitignored local config, not part of this branch's diff) — pre-existing and out of scope. `npm audit`: 0 vulnerabilities. No hardcoded secrets in the diff.

## 🟡 WARNING (both fixed)

### 1. ~~The gate's dispatch-blocking behavior is not covered by a test that exercises the real wiring~~ — FIXED
**Original file:** `src/apply.test.ts:203-263`, production code at `src/index.ts:215-226`

Original problem: the "gate blocks dispatch" tests re-implemented the gate pattern locally instead of exercising the real `src/index.ts` wiring, which lived inline inside a Commander `.action()` closure. A reordering regression in `src/index.ts` wouldn't have been caught by any test.

**Fix applied:** extracted the orchestration into `selectRecordsForApply(previewRecords, onlyIds)` in `src/apply/index.ts`, returning a discriminated union `{ blocked: true; problematicRecords } | { blocked: false; records }`. `src/index.ts` now calls this function directly and can only reach dispatchable records through the `blocked: false` branch — the type system prevents the gate check from being skipped or reordered around the dispatch loop. `src/apply.test.ts`'s `describe('selectRecordsForApply', ...)` tests the actual function the CLI calls: blocking behavior, `--only-id` interaction, and (via `'records' in selection` / `'problematicRecords' in selection` checks) that each branch's variant genuinely lacks the other's field, so there is no `.records` to iterate when blocked. An earlier draft of this fix also added a test that manually looped over `selection.records` and called `dispatchTransaction` itself to assert the mock was invoked — dropped on review, since that only proves the test's own hand-written loop ran, not anything about `src/index.ts`'s real dispatch loop (which still isn't unit-tested; `dispatchTransaction`'s create/confirm routing is already covered separately in `describe('dispatchTransaction', ...)`). The remaining gap — the literal loop-and-prompt code in `src/index.ts` — is accepted as covered by manual verification (task 4.2) rather than force-fit into a unit test. Manually re-verified end-to-end against a synthetic fixture: gate still fires (exit 1, nothing sent) and preview modes are still unaffected.

### 2. ~~Diagnostic output for `identified=false` records omits the transaction id/description~~ — FIXED
**Original file:** `src/index.ts:218-223`, root cause in `src/apply/preview/tochka.ts`

Original problem: `record.normalized?.transactionId ?? '(unknown id)'` always fell back to `(unknown id)` for `identified=false` records, since `normalized` is never populated on those paths — even when the source id/description had already been successfully parsed before the failure.

**Fix applied:** added `describeSourceRecord(sourceRecord)` to `src/apply/preview/tochka.ts`, a best-effort fallback using the already-private `getTransactionId`/`getDescription` extractors. The gate's printer in `src/index.ts` now uses `record.normalized` when available, falling back to `describeSourceRecord(record.sourceRecord as TochkaSyncRecord)` otherwise. Verified manually: a record failing classification (`no matching included/excluded condition`) on a structurally-recognized type_code now prints its real id and description (`4392322077: VERNYJ 1553 — no matching included/excluded condition`) instead of `(unknown id)`. Genuinely unparseable records (e.g. a completely unrecognized `type_code` shape) still show `(unknown id)` — unavoidable since there's no known field layout to extract from, but this is now the exception rather than the common case. Covered by new tests in `describe('describeSourceRecord', ...)`.

## 🟢 SUGGESTION (left as-is)

### 3. Defensive fallback `record.reason ?? '(no reason)'` is unreachable
**File:** `src/index.ts:223`

Every record `findProblematicRecords` returns always carries a non-null `reason` string per current invariants, so this fallback is dead code — harmless, and removing it would require a non-null assertion that trades a false sense of type-safety for saving one dead branch. Left unchanged per the review's own assessment that this is fine to leave.

---

No 🔴 CRITICAL findings. Both WARNING items were fixed; verified with `npm run typecheck` (clean), `npx biome check src/` (clean, 85 files), `npx vitest run` (173/173 passing), and a manual end-to-end re-check in an isolated sandbox.
