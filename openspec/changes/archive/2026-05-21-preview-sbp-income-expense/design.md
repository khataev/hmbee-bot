## Context

The preview pipeline already supports a three-outcome decision model and config-driven preview rules, but the first SBP transaction families in Tochka data are still left unclassified. Based on the observed fixtures, the next practical slice is to support SBP records that can already be interpreted as income or expense without taking on full transfer modeling.

The important boundary in this change is between transfer detection and transfer pairing. Transfer detection is required now so that own-account transfers are not misclassified as income or expense. Transfer pairing remains out of scope because it introduces a separate problem: matching mirrored legs and choosing a canonical transfer representation.

## Goals / Non-Goals

**Goals:**
- Support `SbpC2BPayment` preview as an expense in the observed accepted outgoing cases.
- Support `SbpC2BRefund` preview as an income in the observed accepted incoming cases.
- Support the non-transfer expense slice of `SbpB2CPayment`.
- Detect transfer-like SBP records before income/expense classification so own-account cases are not treated as save-ready expense or income.
- Keep the implementation small, fixture-driven, and aligned with the existing preview contract.

**Non-Goals:**
- Pairing mirrored transfer legs into a single transfer object.
- Producing canonical transfer preview output.
- Supporting every possible SBP status or rare upstream shape in one pass.
- Moving transfer or transaction-kind semantics into config.
- Calling the Honey Money API or changing persistence behavior.

## Decisions

### Decision: Classify SBP records in a transfer-first order
The preview pipeline for the supported SBP slice will first determine whether a record is transfer-like between my own accounts. Only records that are not transfer-like will continue into income/expense classification.

Rationale:
- Prevents `SbpB2CPayment` own-account cases from being mislabeled as expenses.
- Matches the agreed semantic order: transfer first, then income or expense.
- Keeps the logic explicit and easier to test than inferring type after normalization.

Alternative considered:
- Classify income or expense first and patch over transfer cases later. Rejected because it would encode the wrong precedence and make transfer-like cases harder to reason about.

### Decision: Treat `SbpC2BPayment` as the first supported SBP expense family
For this change, `SbpC2BPayment` records in the observed accepted outgoing cases are treated as save-ready expenses.

Rationale:
- The observed fixtures consistently look like payments to merchants or billers.
- The family has a stable enough shape for a narrow first slice.
- It adds useful preview coverage without needing transfer pairing.

Alternative considered:
- Leave `SbpC2BPayment` unsupported until all SBP families are handled together. Rejected because the observed data already supports a reliable expense-first slice.

### Decision: Treat `SbpC2BRefund` as the first supported SBP income family
For this change, `SbpC2BRefund` records in the observed accepted incoming cases are treated as save-ready income.

Rationale:
- The observed fixtures consistently look like merchant refunds back to my account.
- The family naturally complements the `SbpC2BPayment` expense slice.
- It fits the current preview model without introducing transfer-specific complexity.

Alternative considered:
- Defer refunds to a later change until more examples are collected. Rejected because the current observed refund shape is already specific enough for preview support.

### Decision: Support only the non-transfer slice of `SbpB2CPayment`
`SbpB2CPayment` will be supported only when the record is not transfer-like between my own accounts. Own-account cases are detected and excluded from the save-ready income/expense flow in this change.

Rationale:
- `SbpB2CPayment` mixes ordinary outgoing person-to-person payments with own-account transfer-like cases.
- The non-transfer expense slice is useful now, while the own-account slice needs later transfer handling decisions.
- This keeps the change aligned with the agreed “income/expense first, transfer pairing later” plan.

Alternative considered:
- Fully support `SbpB2CPayment` transfers now. Rejected because that would pull transfer pairing and transfer output decisions into this change.

### Decision: Use the existing account registry from configuration for transfer detection
Transfer-like detection in this change will rely on the configured account mappings already available in the source configuration. No separate ownership model is introduced.

Rationale:
- Matches the agreed model that the configured account registry is sufficient.
- Avoids inventing a second ownership abstraction.
- Keeps the implementation anchored to existing configuration semantics.

Alternative considered:
- Add a separate ownership layer or dedicated transfer registry. Rejected because the configured account mappings already provide the necessary source of truth for this slice.

### Decision: Keep transfer-like own-account cases out of save-ready output until a later change
When a supported SBP family is detected as transfer-like between my own accounts, this change will not attempt to normalize it into a transfer object. Instead, it stays out of the save-ready income/expense flow.

Rationale:
- Avoids conflating transfer detection with transfer modeling.
- Preserves the narrow scope of the change.
- Keeps later transfer pairing decisions open.

Alternative considered:
- Emit provisional transfer objects now. Rejected because transfer pairing and canonical transfer output are explicitly deferred.

## Risks / Trade-offs

- [Risk] Observed SBP fixtures may not cover every real-world upstream variation. -> Mitigation: keep the supported slice narrow and leave unmatched or unsupported cases visible in preview.
- [Risk] `SbpB2CPayment` may contain transfer-like and non-transfer cases that look superficially similar. -> Mitigation: run transfer detection before expense classification and rely on configured account mappings instead of names.
- [Risk] Refund coverage is based on a smaller sample than expense coverage. -> Mitigation: support only the observed accepted incoming refund pattern and keep broader cases for later review.
- [Risk] This change could accidentally drift into transfer implementation. -> Mitigation: explicitly exclude transfer pairing and transfer object output from tasks and validation.

## Migration Plan

No production migration is required. This is a preview-only expansion of supported Tochka families.

Implementation rollout:
1. Extend preview classification for the supported SBP families with transfer-first decision flow.
2. Add focused fixture-backed tests for `SbpC2BPayment`, `SbpC2BRefund`, and the non-transfer `SbpB2CPayment` slice.
3. Add tests proving transfer-like own-account cases are not treated as save-ready income/expense in this change.
4. Validate with focused tests and `npm run check`.

Rollback strategy:
- Remove the added SBP family handling and restore the previous unsupported behavior for those type codes.

## Open Questions

- Should this change support only the observed `ACCEPTED` statuses, or should any additional SBP statuses be included if found during implementation?
- Is there any observed SBP family in current fixtures that should remain explicitly unsupported even if it superficially resembles income or expense?

## Engineering Constraints

- Preserve strict typing across source record handling, transfer detection, and preview output.
- Keep semantic transaction classification in code; do not move transfer or transaction-kind semantics into configuration in this change.
- Keep transfer detection separate from transfer pairing and do not introduce mirrored-leg matching logic.
- Prefer fixture-backed tests that prove the transfer-first classification order.
- Keep module boundaries explicit: config provides account mappings, preview classification decides support and transfer-like status, and normalization produces only save-ready income/expense output for the supported slice.
- Validate the change with focused tests and `npm run check` before marking tasks complete.