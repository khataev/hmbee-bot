# Review Report: fetch-tochka-paginated-timeline

## Scope Reviewed
- .env.example
- STYLEGUIDE.md
- openspec/changes/fetch-tochka-paginated-timeline/tasks.md
- src/adapters/tochka.ts

## Security & Audit
- Hardcoded secret/token scan (focus on src/adapters/): no hardcoded credentials detected.
- npm audit: no vulnerabilities found (0 total; 0 critical).

## Findings

### 🟡 WARNING (Accepted/Deferred)
1. [ACCEPTED] Pagination cursor progress is not guaranteed and can cause duplicate page accumulation before forced stop.
   - Location: src/adapters/tochka.ts:117, src/adapters/tochka.ts:119, src/adapters/tochka.ts:132, src/adapters/tochka.ts:135
   - Why it matters: if upstream returns a full page with the same trailing event_date repeatedly, loop progress is not validated. The current safety cap (100 pages) prevents infinite execution, but still allows large duplicate datasets and unnecessary upstream load.
   - Decision: Risk accepted by user as probability of collision (two cards on same account at same microsecond) is negligible.

2. [DEFERRED] Numeric parsing accepts invalid values as NaN without schema rejection.
   - Location: src/adapters/tochka.ts:33
   - Why it matters: external input validation should reject malformed data at boundary. Number(...) can produce NaN, which is currently accepted and propagated.
   - Decision: Deferred for now as input is expected to be strictly numeric strings or numbers.

3. Config default mismatch between docs/example and production behavior.
   - Location: .env.example:2, src/adapters/tochka.ts:59, openspec/changes/fetch-tochka-paginated-timeline/tasks.md:16
   - Why it matters: .env.example sets TOCHKA_PAGE_SIZE=50 while implementation default/final task states 250. This can cause inconsistent runtime behavior across environments.
   - Suggested fix: set .env.example TOCHKA_PAGE_SIZE to 250 (or explicitly document 50 as a temporary debug value and adjust task text).

### 🟢 SUGGESTION
1. Extract large request literals to named constants to improve readability and maintenance.
   - Location: src/adapters/tochka.ts:176, src/adapters/tochka.ts:241
   - Why it matters: long inline arrays and tags are source-specific (correct layer), but still high-churn magic string blocks that are hard to diff/review.
   - Suggested fix: move transaction type filters and exclude_tags to top-level typed constants in the adapter.

2. OpenSpec task status appears stale for implemented pagination loop.
   - Location: openspec/changes/fetch-tochka-paginated-timeline/tasks.md:4
   - Why it matters: task 1.2 is unchecked, but implementation exists in `sync` with looped fetching.
   - Suggested fix: update task checkbox to keep implementation and artifact status aligned.

## Style Guide Compliance Summary
- any usage: none found in reviewed changes.
- unknown for uncertain input: used appropriately for parsed response/raw payload.
- External input validation: present via Zod; one gap remains for NaN handling in transformed numeric field.
- Error handling: informative and fail-fast behavior is implemented; no silent swallowing observed.
- Adapter boundary: Tochka-specific logic remains isolated in src/adapters/tochka.ts.

## Overall
Implementation is close to merge quality and passes project checks (`npm run check`). Address the warning-level items above before finalizing to reduce data correctness and operational risks.
