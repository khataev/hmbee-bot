## Why

The preview pipeline already supports the decision model needed for known Tochka transaction families, but it still leaves key SBP records unclassified. The next useful slice is to make the observed SBP income and expense cases visible in preview without taking on full transfer modeling and transfer pairing in the same change.

This change should support `SbpC2BPayment`, `SbpC2BRefund`, and the non-transfer expense slice of `SbpB2CPayment`. Transfer detection remains necessary to avoid misclassifying transfers as income or expense, but transfer pairing and canonical transfer output stay for a later change.

## What Changes

- Add preview support for Tochka `SbpC2BPayment` records as supported SBP expense records in the observed accepted outgoing cases.
- Add preview support for Tochka `SbpC2BRefund` records as supported SBP income records in the observed accepted incoming cases.
- Add the first preview support for Tochka `SbpB2CPayment` by handling only the non-transfer expense slice.
- Detect when an SBP record is transfer-like between my own accounts so that transfer cases are not misclassified as income or expense.
- Keep transfer pairing, mirrored-leg deduplication, and canonical transfer normalization out of scope for this change.
- Validate the new SBP preview behavior with focused fixture-backed tests and `npm run check`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `source-preview`: Preview classification and normalization expand to cover the first supported SBP income and expense cases while continuing to exclude transfer handling from the save-ready flow.

## Impact

- Affected code: Tochka preview classification, Tochka preview normalization, config loading for account mappings, and focused preview tests.
- Affected inputs: synchronized Tochka records with `type_code` values `SbpC2BPayment`, `SbpC2BRefund`, and `SbpB2CPayment`.
- Affected output contract: preview will classify the supported SBP records as save-ready income or expense when they are not transfer-like, while leaving transfer modeling itself for a later change.
- Quality constraints: transfer detection must happen before income/expense classification for the supported SBP slice; this change must not introduce transfer pairing logic; focused tests and `npm run check` are required before completion.