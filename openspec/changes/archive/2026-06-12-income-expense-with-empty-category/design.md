## Context

`normalizeTochkaRecord` ([src/apply/preview/tochka.ts](../../../src/apply/preview/tochka.ts)) builds a `PreviewRecord` in two stages:

1. `classifyByRule` evaluates the configured `included`/`excluded` JSON-logic predicates and yields `{ identified, save, reason }`.
2. For identified non-transfer records, `buildHoneyMoneyIncomeExpenseTransaction` resolves the category via `mapTochkaCategory(description, mcc, categoryMapping)`. When no MCC or title rule matches, the entry is `null` and the resulting `hmbee.category` is `null` — yet `save` stays `true`.

The category is only known *after* `hmbee` is built, so the missing-category check cannot live inside `classifyByRule` (which has no category context). It is a post-mapping concern.

Transfers go through `buildHoneyMoneyTransferTransaction`, which always sets `category = null` by design — they must be exempt.

## Goals / Non-Goals

**Goals:**
- Prevent income/expense records with a null resolved category from being save-ready.
- Emit a clear, dedicated `reason` so operators can find and fix the missing mapping.
- Keep the `hmbee` branch in the output for inspection.

**Non-Goals:**
- Changing how categories are resolved (MCC/title matching logic is untouched).
- Changing transfer handling or the `included`/`excluded` predicate engine.
- Auto-creating or guessing categories.
- Any config-shape or CLI changes.

## Decisions

**Decision: Apply the downgrade as a post-mapping step in the income/expense return path of `normalizeTochkaRecord`, after `hmbee` is built.**

The income/expense branch already constructs `hmbee` via `buildHoneyMoneyIncomeExpenseTransaction`. Right before returning, inspect the built transaction: if `hmbee.category === null`, return `{ identified: true, save: false, reason: "Category is missing for income or expense transaction", sourceRecord, normalized, hmbee }` instead of the save-ready result. Because this branch is reached only for `type` `income`/`expense` (transfers return earlier), no extra subtype guard is needed — the location itself scopes the rule.

- *Alternative considered — check inside `buildHoneyMoneyIncomeExpenseTransaction`:* rejected. That function returns a `HoneyMoneyTransaction`, not a classification; pushing save/reason into it would blur responsibilities and complicate its signature.
- *Alternative considered — a generic post-processing pass over the final `PreviewRecord` keyed on `hmbee.subtype IN (i,e)`:* viable and matches the operator's jq query shape, but adds a second place that reasons about subtypes. The income/expense return path is the single natural choke point and keeps the change local. The `subtype`-based framing is preserved in the spec and reason text.

**Decision: Define the reason string as a single named constant.**

Introduce `const MISSING_CATEGORY_REASON = 'Category is missing for income or expense transaction'` near the top of the module so the string is not duplicated between implementation and tests' intent. Exact text is contract per the spec.

## Risks / Trade-offs

- **Existing tests assert `save = true` / null-category happy paths** (e.g. `preview-CardTransactionInfo.test.ts` "returns null category and amount-only description") → Update those cases to expect `save = false` and the new reason. This is intended behavior change, captured in tasks.
- **Operators may see more non-save-ready records** if category mappings are incomplete → This is the desired signal; it surfaces gaps rather than silently writing uncategorized transactions.
- **Reason-string drift between code and spec** → Mitigated by the single constant and a focused test asserting the exact string.

## Open Questions

None.
