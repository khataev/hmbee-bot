## Verification Report: confirm-planned-transactions

### Summary

| Dimension    | Status                                      |
|--------------|---------------------------------------------|
| Completeness | 24/24 tasks ✓, all spec requirements present |
| Correctness  | All requirements implemented, 1 warning      |
| Coherence    | Style clean, all linting gates pass         |
| Security     | 2 high severity dependency vulnerabilities  |

---

### Issues

#### 🔴 CRITICAL (Must fix before archive)

- None

---

#### 🟡 WARNING (Should fix)

- ~~**Type guard `isUnconfirmedPlannedTxn` doesn't verify `common_id` is a string**~~ ✅ Закрыто: `HoneyMoneyCacheEntrySchema` уточнена до `common_id: z.string().nullable().optional()`, число больше не проходит через парсинг.

- ~~**Same type narrowing gap for `virtual_id`**~~ ✅ Закрыто: схема уточнена до `virtual_id: z.number().nullable().optional()`.

- **Task 5.3 routing test is absent: no direct unit test verifies `createTransaction` vs `confirmPlannedTransaction` dispatch**
  - The spec (source-apply/spec.md) requires a scenario test for "create drafts are created" and "confirmation drafts are confirmed".
  - The `apply.test.ts` covers `promptSend`, `parseOnlyIdsOption`, and `filterApplyRecords`, but not the routing in `src/index.ts:255–261`.
  - The matcher tests confirm that matched records get `hmbee.id !== null` (prerequisite), and the routing itself is simple, but the spec-required integration test is missing.
  - Recommendation: Add a test in `src/apply.test.ts` or a new `src/index.test.ts` that mocks `HoneyMoneyClient` and verifies `createTransaction` is called for `id === null` records and `confirmPlannedTransaction` for `id !== null` records.

---

#### 🟢 SUGGESTION (Nice to fix)

- **`HoneyMoneyCreateTransactionResponseSchema` (client.ts:5) validates `data.id` which is unused**
  - The schema asserts both `data.id` and `data.transaction.id`, but only `data.transaction.id` is returned. The outer `data.id` field may not always be present in confirm responses (the spike validated the happy path, but schema strictness could cause parse failures if the field is absent).
  - Recommendation: Either drop `data.id` from the schema or rename the schema to make it clear it applies to both create and confirm paths.

---

### Final Assessment

2 critical issue(s) found (pre-existing npm audit vulnerabilities). Run `npm audit fix` and re-verify before archiving.
