# Code Review: match-planned-transactions

**Branch**: `HMB-25-match-planned-transactions`
**Reviewed**: 2026-06-17
**Status**: 2 CRITICAL (pre-existing deps), 2 WARNING, 3 SUGGESTION

---

## 🔴 CRITICAL

### C1 — npm audit: 2 high-severity dependency vulnerabilities

These are **pre-existing** vulnerabilities (not introduced by this change), but they must be addressed before shipping.

```
form-data 4.0.0–4.0.5   CRLF injection in multipart field names/filenames
                         https://github.com/advisories/GHSA-hmw2-7cc7-3qxx

vite 8.0.0–8.0.15       NTLM hash disclosure via UNC path on Windows
                         server.fs.deny bypass on Windows alternate paths
                         https://github.com/advisories/GHSA-v6wh-96g9-6wx3
```

Fix: `npm audit fix`

---

## 🟡 WARNING

### W1 — Magic number `0.2` for tolerance (`plannedMatcher.ts:90`)

```typescript
return Math.abs(sourceAbs - planAbs) <= 0.2 * planAbs;
```

`0.2` (20%) is a business rule. It appears only once, so it's not a DRY problem, but it's not discoverable or configurable. A reader has to read the `isWithinTolerance` function name and check the design doc to understand what the threshold is. Extract as a module-level constant:

```typescript
const AMOUNT_MATCH_TOLERANCE = 0.2; // 20% of plan_amount
```

### W2 — `type: 'planned'` inferred as `string`, forcing unsafe `as` cast (`plannedMatcher.ts:75–85`)

```typescript
const planOverrides = {
  id: plan.id,
  type: 'planned',        // TypeScript infers: string, not 'planned'
  plan_amount: plan.plan_amount,
  common_id: plan.common_id ?? null,
  virtual_id: plan.virtual_id ?? null
};
// ...
return { ...createDraft, ...planOverrides } as HoneyMoneyConfirmTransferTransaction;
```

Because `type` is inferred as `string`, the spread result is not assignable to the confirm types, requiring the `as` cast which bypasses type checking. If the confirm type signatures change, TypeScript won't catch a mismatch here.

Fix: add `as const` to the literal, or narrow it inline:

```typescript
const planOverrides = {
  id: plan.id,
  type: 'planned' as const,
  plan_amount: plan.plan_amount,
  common_id: plan.common_id ?? null,
  virtual_id: plan.virtual_id ?? null
};
```

With `as const`, the `as` casts on lines 83–85 can likely be dropped or at minimum TypeScript will verify the structural match.

---

## 🟢 SUGGESTION

### S1 — Typo in test description (`plannedMatcher.test.ts:120`)

```typescript
it('1:1 — two source transactions, one planed: only first matches', () => {
```

"planed" → "planned"

### S2 — Non-standard `// HINT:` prefix (`plannedMatcher.ts:39`)

```typescript
// HINT: 'matched' is always present at this point, this check here only just to make TS happy
```

The `// HINT:` prefix is not used anywhere else in the codebase. The comment itself is fine (explaining a subtle invariant / TypeScript workaround), but the prefix adds noise. Consider:

```typescript
// candidates.length > 0 was verified above; TS can't track it through selectBest's return type
```

### S3 — Silent precedence of `--preview-planned` over `--preview` (`index.ts:158–197`)

When a user passes both `--preview-planned` and `--preview`, `--preview-planned` wins silently because its check appears first. This is a minor UX issue — a user combining both flags might be surprised. Consider an early guard:

```typescript
if (options.previewPlanned && options.preview) {
  console.error('--preview-planned and --preview are mutually exclusive; using --preview-planned');
}
```

Or document it in the option description. Not blocking, but could confuse users.

---

## Summary: what's good

- Architecture is clean: `plannedIndex`, `plannedMatcher`, `previewPlanned` are properly scoped modules.
- The 1:1 plan consumption via index mutation (`candidates.splice(idx, 1)`) is correct and tested.
- Tolerance math uses `Math.abs` on both sides — handles negative `plan_amount` values correctly.
- `yearMonths` derivation in `buildPreviewPlannedOutput` correctly derives period from actual records, not from an arbitrary date range.
- All 105 tests pass, typecheck clean, lint clean.
- Transfer category exclusion from the index key is correctly implemented and tested.
- Design doc decision to keep confirm drafts `save=true` (deferring the actual POST to the runner) is honestly reflected: no fake `save=false` hacks.
