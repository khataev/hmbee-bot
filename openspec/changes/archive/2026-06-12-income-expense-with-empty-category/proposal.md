## Why

Some identified income and expense Tochka records reach `save = true` while their resolved Honey Money category is `null` (no MCC or title mapping matched). Saving an income/expense transaction without a category is not acceptable for downstream Honey Money bookkeeping: such records must be surfaced for operator review instead of being written automatically.

This is observable today:

```
npx tsx src/index.ts apply tochka --preview --quiet | jq '[.[] | select(.identified == true and (.hmbee.subtype | IN ("i", "e")) and .hmbee.category == null)]'
```

## What Changes

- After classification and category mapping, a record whose normalized `type` is `income` or `expense` (Honey Money `subtype` `i` or `e`) and whose resolved `hmbee.category` is `null` SHALL be downgraded to **not save-ready**: `identified = true`, `save = false`, `reason = "Category is missing for income or expense transaction"`.
- Transfer records (`subtype = t`) are unaffected — they legitimately carry `category = null`.
- Records that already failed identification (`identified = false`) are unaffected.
- The `hmbee` branch is still emitted so the operator can inspect the would-be transaction in preview output.
- Add focused automated test coverage for the missing-category downgrade across income and expense flows.

No breaking changes to config shape, CLI surface, or public types.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `source-preview`: A new requirement constrains save intent for identified income/expense records — a missing category forces `save = false` with a dedicated reason, separate from the existing `included`/`excluded` classification outcomes.

## Impact

- Code: `src/apply/preview/tochka.ts` (`normalizeTochkaRecord` post-mapping step).
- Tests: `src/apply/preview-*.test.ts` (income/expense fixtures with empty/unmatched category mapping; existing "returns null category" cases must be updated to expect the new save/reason values).
- Docs: `TRANSACTION-RULES.md` (add the missing-category downgrade as a cross-cutting rule).
- No config, dependency, or API changes.
- Quality gates: `npm run check` (typecheck + lint + tests) must pass per the project Definition of Done.
