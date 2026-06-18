## Verification Report: fix-planned-match-greedy

### Summary

| Dimension    | Status                           |
|--------------|----------------------------------|
| Completeness | 26/26 tasks, 4 requirements ✓   |
| Correctness  | All scenarios covered ✓          |
| Coherence    | Design followed, style clean ✓  |
| Security     | No secrets; pre-existing vulns → TECH-DEBT #9 |

---

### Issues

#### 🔴 CRITICAL (Must fix before archive)

_None._

#### 🟡 WARNING (Should fix)

_None._

#### 🟢 SUGGESTION (Nice to fix)

- **Task 3.4 — absence assertion missing**
  - Spec: "Diagnostic fields are absent unless beaten" — `lostPlanId`/`beatenById` must be absent for all non-beaten statuses
  - Existing test (`plannedMatcher.test.ts:156`) verifies presence for `beaten-match` but does not assert `resultExact?.planMatch?.lostPlanId` is `undefined`
  - By construction the implementation never sets these fields outside the `beaten` branch, so correctness is guaranteed; the test could be tightened for documentation value
  - Recommendation: Add `expect(resultExact?.planMatch?.lostPlanId).toBeUndefined()` in the existing "exact beats near-miss" test

- **Defensive `else` branch in beaten-match resolution** (`plannedMatcher.ts:231–235`)
  - When `winnerId` is `undefined` after looking up `consumedBy.get(bestEdge.planIndex)`, the code falls back to `out-of-tolerance`, which is semantically inaccurate (the real was in-tolerance, just defeated)
  - Analysis: this branch should be unreachable in correct execution — every plan consumed by a greedy assignment is recorded in `consumedBy`, and a real only stays in `freeReals` when its plan was consumed
  - Recommendation: Add a short comment explaining the invariant, e.g. `// winnerId is always defined here: freePlans ∖ consumedBy = ∅ after the greedy loop`

---

### Verification Details

#### Completeness

All 26 tasks are marked `[x]` in `tasks.md`. The implementation covers all four spec requirements declared in `specs/planned-transaction-matching/spec.md`:

| Requirement | Implemented in |
|---|---|
| Apply matches real → planned | `plannedMatcher.ts:applyMatchPass` |
| One-to-one deterministic tie-break | `plannedMatcher.ts:resolveBucket` |
| PlanMatch structured object + beaten diagnostics | `types.ts:PlanMatch`, Phase 3 write-back |
| Beaten-match visible in planned view | `previewPlanned.ts:selectPlanRelevantRecords` |

#### Correctness

All scenarios from the spec are covered:

- **"Matched record carries confirm-shaped hmbee draft"** — `buildConfirmHmbee` sets `id`, `type=planned`, `plan_amount`, `common_id`, `virtual_id`; Phase 3 keeps `identified=true`, `save=true`, `reason=null` unchanged ✓
- **"Create vs confirm distinguished by hmbee id"** — `id: plan.id` (confirm) vs `id: null` (create) ✓
- **"Exact competitor wins the plan over a near one-off"** — verified by test at `plannedMatcher.test.ts:156` and order-independence test at `plannedMatcher.test.ts:173` ✓
- **"Ambiguous match reported symmetrically"** — tie detection handles both directions (real equidistant between plans, and plan contested by two reals at equal distance) at `plannedMatcher.ts:181–195`; covered by tests at `plannedMatcher.test.ts:186` and `plannedMatcher.test.ts:196` ✓
- **"Beaten record records the lost plan and the winner"** — `lostPlanId` points to `bestEdge.planIndex` plan id, `beatenById` to `consumedBy.get(planIndex)` winner transactionId ✓
- **"Beaten-match shown, no-candidate hidden"** — `selectPlanRelevantRecords` filters `planMatch === undefined || status === 'no-candidate'`; verified by `previewPlanned.test.ts:43` ✓

#### Coherence

**Design adherence:**
- Three-phase scheme (collect → resolve per bucket → write back) implemented exactly as designed; no stream mutation ✓
- Greedy quality-first: edges sorted by `amountDiff` then `dateDiff` (amount primary as per Decision 2) ✓
- `PlanMatch` interface with optional `lostPlanId?`/`beatenById?` matches Decision 4 ✓
- TECH-DEBT.md item 8 (Variant C fallback) documented ✓

**TypeScript style:**
- No `any` in any changed file ✓
- All exported functions have explicit return types ✓
- `sourceRecord: unknown` at external boundary ✓
- All imports use absolute `src/` paths — no relative imports ✓

**Error handling:**
- Match pass is total: every processed record receives a `planMatch` status; no exceptions thrown ✓
- All outcomes (`no-candidate`, `out-of-tolerance`, `ambiguous`, `beaten-match`) are explicit; no silent falls ✓

**Testing:**
- Tests use `expect()` assertions throughout; no `throw` for type narrowing ✓
- 17 test files, 100 tests — all pass ✓

**Linting gates:**
- `npm run typecheck` — clean ✓
- `npm run lint` (Biome) — clean ✓
- `npm run check` — clean (typecheck + lint + all tests pass) ✓

#### Security

- No hardcoded secrets, tokens, or credentials in any changed file ✓
- No new external dependencies introduced ✓
- `npm audit` reports 2 high-severity vulnerabilities — both pre-existing in dev tooling (`form-data` via transitive deps, `vite` as the vitest runner); neither was introduced by this change and neither affects production runtime

---

### Final Assessment

No critical issues. 2 suggestion(s) to consider. Ready for archive (with noted improvements).

> Pre-existing npm audit vulnerabilities moved to TECH-DEBT #9 — they predate this change and affect dev tooling only. The implementation is complete, correct, coherent, and passes all quality gates.
