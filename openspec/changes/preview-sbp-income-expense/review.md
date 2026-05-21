# Review Report: preview-sbp-income-expense

## Scope Reviewed
- src/apply/preview/tochka.ts
- src/apply/preview.test.ts
- src/apply/preview/fixtures/ (sbp-c2b-payment.json, sbp-c2b-refund.json, sbp-b2c-payment-non-transfer.json, sbp-b2c-payment-own-transfer.json)
- openspec/changes/preview-sbp-income-expense/design.md
- openspec/changes/preview-sbp-income-expense/tasks.md
- openspec/changes/preview-sbp-income-expense/specs/source-preview/spec.md

## Security & Audit
- Hardcoded secret/token scan (focus on `src/adapters/`): no hardcoded credentials or tokens detected in any changed file.
- `npm audit`: no vulnerabilities found (0 total; 0 critical).

## Findings

### 🟡 WARNING

1. `as never` casts in fixture-backed tests bypass TypeScript type checking.
   - Location: `src/apply/preview.test.ts` — all four fixture-backed assertions inside `describe('SBP fixture-backed classification', ...)` use `as never` when passing `sourceRecord` (typed `unknown`) to `normalizeTochkaRecord`.
   - Why it matters: `as never` is semantically equivalent to `as any` as a type escape hatch. STYLEGUIDE.md explicitly states "Avoid `any`". For the fixture tests the intent is a safe cast to the expected type; `as TochkaSyncRecord` is more precise and communicates that intent without silently removing all type constraints.
   - Suggested fix: replace `c2bPayment as never`, `c2bRefund as never`, `nonTransferB2C as never`, `transferLikeB2C as never` with `c2bPayment as TochkaSyncRecord` (etc.). The intentional-bad-shape test (`{ wrong: 'shape' } as never`) is a separate case; `as unknown as TochkaSyncRecord` is the idiomatic pattern there.


### 🟢 SUGGESTION

1. SBP records have no `mcc` field; category resolution always falls through to description/title matching.
   - Location: `src/apply/preview/tochka.ts:getMcc`, `mapTochkaCategory`
   - Why it matters: `getMcc` returns `undefined` for all SBP record types. `mapTochkaCategory` then skips the MCC branch entirely and proceeds to title-keyword matching. This is correct behaviour, but there is no comment to indicate it is intentional. A reader unfamiliar with the SBP data shape may wonder why the MCC lookup is never exercised for SBP records.
   - Suggested fix: add a brief inline comment in `getMcc` noting that SBP families do not carry MCC and category resolution relies solely on description matching.

## Style Guide Compliance Summary
- `any` usage in production code: none found.
- `unknown` for uncertain input shapes: used appropriately (`UnsupportedTochkaRecord.data: unknown`).
- External input validation: required fields (`transactionId`, `account`, `currency`, `status`, `amount`, `description`) are guarded with explicit `throw` statements before use; `normalizeTochkaRecord` wraps the full path in `try/catch` and returns a safe `PreviewRecord` on error.
- Error handling: informative errors with context; no silent swallowing; the `catch` block surfaces the error message in `reason`.
- Adapter boundary: all SBP type interfaces, type guards, and normalization logic remain in `src/apply/preview/tochka.ts`.
- Absolute imports: all imports in changed files use `src/` prefix. ✓
- `npm run check`: passes (typecheck + lint + all 70 tests green). ✓

## Overall
The implementation is correct and well-structured. The SBP classification model (transfer-first, then income/expense) is coherent with the design decisions and is fully exercised by fixture-backed tests. The one remaining WARNING item is minor but addressable before merge to stay aligned with style guide expectations. The two SUGGESTION items are non-blocking.
