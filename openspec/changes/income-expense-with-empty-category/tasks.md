## 1. Implementation

- [ ] 1.1 Add a `MISSING_CATEGORY_REASON = 'Category is missing for income or expense transaction'` constant in [src/apply/preview/tochka.ts](../../../src/apply/preview/tochka.ts).
- [ ] 1.2 In `normalizeTochkaRecord`, in the income/expense return path (after `hmbee` is built via `buildHoneyMoneyIncomeExpenseTransaction`), downgrade records whose `hmbee.category === null` to `{ identified: true, save: false, reason: MISSING_CATEGORY_REASON }` while still returning `normalized` and `hmbee`.
- [ ] 1.3 Confirm transfer records (`buildHoneyMoneyTransferTransaction` path) and unidentified records are not affected by the new check.

## 2. Tests

- [ ] 2.1 Update the existing "returns null category" case in [src/apply/preview-CardTransactionInfo.test.ts](../../../src/apply/preview-CardTransactionInfo.test.ts#L330) to expect `identified = true`, `save = false`, and `reason = "Category is missing for income or expense transaction"` (keep the amount-only description assertion).
- [ ] 2.2 Add a focused expense test: an identified expense record with an empty/unmatched `categoryMapping` is downgraded to not save-ready with the exact reason, and `hmbee` is still present.
- [ ] 2.3 Add a focused income test (e.g. `SbpC2BRefund` or `PaymentIncome`) with empty/unmatched `categoryMapping` asserting the same downgrade.
- [ ] 2.4 Add a regression test asserting transfer records with `category = null` remain save-ready (unaffected by the new rule).

## 3. Documentation & Quality Gates

- [ ] 3.1 Add the missing-category downgrade to [TRANSACTION-RULES.md](../../../TRANSACTION-RULES.md) as a cross-cutting rule (income/expense with `category = null` → `identified=true`, `save=false`, `reason="Category is missing for income or expense transaction"`).
- [ ] 3.2 Run `npm run check` (typecheck + lint + tests) and ensure it passes.
