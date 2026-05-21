## Why

The preview pipeline already covers the first SBP income and expense slice, but two observed Tochka families that still belong to the income/expense domain remain outside preview support: `PaymentWrittenOff` and `VedPaymentIncome`.

The next useful slice is to classify only the observed save-ready income/expense cases from those families while continuing to keep transfer-like movements out of scope until dedicated transfer handling begins.

## What Changes

- Add preview support for the observed `PaymentWrittenOff` bank-fee and commission expense slice.
- Exclude transfer-like `PaymentWrittenOff` cases, such as deposit-opening movements, from the save-ready income/expense flow.
- Add preview support for the observed `VedPaymentIncome` incoming slice when the record is still in the supported undistributed state.
- Keep unknown `PaymentWrittenOff` and `VedPaymentIncome` shapes unmatched so they surface for explicit review instead of being forced into income or expense.
- Extend Tochka preview normalization with the record-shape support needed for `PaymentWrittenOff` and `VedPaymentIncome` without introducing transfer pairing or Honey Money write-path changes.
- Validate the new preview behavior with focused fixture-backed tests and `npm run check`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `source-preview`: Preview classification and normalization expand to cover the first supported `PaymentWrittenOff` and `VedPaymentIncome` income/expense cases while continuing to keep transfer handling out of scope.

## Impact

- Affected code: Tochka preview classification, Tochka preview normalization, source config loading, and focused preview tests.
- Affected inputs: synchronized Tochka records with `type_code` values `PaymentWrittenOff` and `VedPaymentIncome`.
- Affected output contract: preview will classify the supported `PaymentWrittenOff` commission cases as save-ready expenses, classify the supported `VedPaymentIncome` cases as save-ready income, exclude observed transfer-like `PaymentWrittenOff` cases, and leave unconfirmed shapes unmatched.
- Quality constraints: preview rules for this change must remain whitelist-only, transfer handling must stay out of scope, and validation must include focused tests plus `npm run check`.