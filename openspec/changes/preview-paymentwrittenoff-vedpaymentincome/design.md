## Context

The current preview classifier in [src/apply/preview/tochka.ts](/Users/khataev/Documents/code/hmbee-bot/src/apply/preview/tochka.ts) supports `CardTransactionInfo` and the first SBP families, but it still rejects the remaining RS and arrival families as unsupported `type_code` values.

Observed Tochka data shows two additional families that belong to the income/expense preview scope but need narrow handling:
- `PaymentWrittenOff` is not uniformly an expense. The observed data contains both bank-fee/commission expenses and transfer-like write-offs such as opening a deposit.
- `VedPaymentIncome` appears to be an incoming payment family in a dedicated arrival flow, but the observed support is still limited to a specific state shape.

This change should extend preview support only for the observed save-ready slices and continue to keep transfer logic, pairing, and Honey Money persistence outside scope.

## Goals / Non-Goals

**Goals:**
- Add preview family support for `PaymentWrittenOff` and `VedPaymentIncome`.
- Keep classification config-driven through `type_codes.conditions` where the observed fields are stable enough.
- Treat observed `PaymentWrittenOff` commission cases as supported expense preview records.
- Treat observed transfer-like `PaymentWrittenOff` cases as identified but excluded from save-ready preview.
- Treat the observed `VedPaymentIncome` undistributed incoming slice as supported income preview records.
- Leave unknown shapes and states unmatched rather than inferring broader semantics.

**Non-Goals:**
- Implement transfer pairing or canonical transfer normalization.
- Expand transfer detection beyond the observed `PaymentWrittenOff` exclusion slice.
- Add Honey Money write-path behavior.
- Generalize all RS or arrival families in one pass.
- Encode broad semantic transaction interpretation in configuration beyond the narrow preview decision rules needed here.

## Decisions

### Decision: `PaymentWrittenOff` support stays narrow and whitelist-only
The preview classifier will support only the observed `PaymentWrittenOff` commission slice as save-ready expense. The supported include signal is the positive, observed commission shape rather than a broad "not transfer" rule.

The first supported include rule should match the observed positive fields:
- `incoming = false`
- `objectState = "Processed"`
- `failed = false`
- `isComission = true`

The first explicit exclude rule should match the observed transfer-like deposit/opening slice with a positive transfer signal:
- `incoming = false`
- `categoryTypeName = "TRANSFER"`

Rationale:
- Matches the observed data without using negation in preview rules.
- Keeps `included` and `excluded` as explicit white lists.
- Prevents unknown `PaymentWrittenOff` subtypes from silently entering the save-ready expense flow.

Alternative considered:
- Include all `PaymentWrittenOff` records except those marked as transfer. Rejected because it violates the whitelist-only rule-authoring discipline and would over-classify unknown write-off subtypes.

### Decision: `VedPaymentIncome` uses a narrow incoming-state slice
The preview classifier will support only the observed `VedPaymentIncome` shape where the receiving account is mine and the record remains in the undistributed state.

The first supported include rule should match the observed positive fields:
- `recipientAccountId` belongs to the configured account registry
- `state = "UNDISTRIBUTED"`

No explicit exclude rule is required for the first slice. Other states remain unmatched until observed and intentionally classified.

Rationale:
- The observed data supports a conservative income slice without committing to broader arrival-flow semantics.
- Leaving unknown states unmatched is consistent with the preview decision contract and whitelist-only rule authoring.

Alternative considered:
- Exclude all non-`UNDISTRIBUTED` states up front. Rejected because the data does not yet justify a deliberate exclusion policy for unseen arrival states.

### Decision: Family shape support remains in code, preview decisions remain in config
This change will continue the existing split of responsibilities:
- TypeScript code in Tochka preview normalization knows how to read each supported record family and derive normalized preview fields.
- Source configuration defines the `included` and `excluded` predicates that decide save-ready, excluded, and unmatched outcomes.

That means `PaymentWrittenOff` and `VedPaymentIncome` need both:
- code-level family support in preview normalization
- config-level rules in `type_codes.conditions`

Rationale:
- `VedPaymentIncome` has a different field shape from the current SBP families, so code support is required before rules can be applied meaningfully.
- The preview rule system remains bounded to decision logic instead of turning into a general semantic transaction engine.

### Decision: Related commission and transfer signals do not trigger pairing logic in this change
Observed data shows that `VedPaymentIncome` can have a nearby related `PaymentWrittenOff` commission record, but this change will classify each supported record independently.

Rationale:
- Keeps the change within preview income/expense scope.
- Avoids mixing VED-related fee handling with transfer or record-pairing semantics.
- Preserves reviewability before the dedicated transfer-handling phase.

## Risks / Trade-offs

- [Risk] Some real expense-like `PaymentWrittenOff` records may remain unmatched because the first include rule only accepts the observed commission slice. -> Mitigation: prefer under-classification to false-positive expense classification and expand only with new evidence.
- [Risk] Future `VedPaymentIncome` states may need explicit exclusion rather than unmatched handling. -> Mitigation: start with the observed `UNDISTRIBUTED` slice only and add state rules when new data appears.
- [Risk] Supporting more record families increases branching in Tochka preview normalization. -> Mitigation: keep family-specific extraction local and avoid broad abstractions before a second consumer exists.
- [Risk] Config expressions could drift toward negative logic. -> Mitigation: keep `included` and `excluded` rules whitelist-only and avoid negation-based authoring.

## Migration Plan

No production migration is required. This is a preview-only expansion.

Implementation rollout:
1. Extend Tochka preview family support to read `PaymentWrittenOff` and `VedPaymentIncome` record shapes.
2. Add config-driven rules for the observed `PaymentWrittenOff` commission include slice, `PaymentWrittenOff` transfer-like exclude slice, and `VedPaymentIncome` undistributed include slice.
3. Add focused fixture-backed tests for save-ready, excluded, and unmatched outcomes.
4. Re-run focused tests and `npm run check`.

## Open Questions

- Are there observed non-commission `PaymentWrittenOff` expense cases that should become save-ready in the next slice, or should they remain unmatched until explicitly reviewed?
- Are there additional `VedPaymentIncome` states that deserve explicit exclusion rather than unmatched handling?
- Should future arrival-family support treat related fee records as a separate expense slice, or leave them independent even after transfer handling lands?

## Engineering Constraints

- Keep preview rule authoring whitelist-only: `included` and `excluded` must enumerate supported positive cases rather than rely on negation.
- Preserve the existing preview decision contract: `identified`, `save`, `reason`, ambiguity handling, and unmatched fallback semantics must remain unchanged.
- Keep module boundaries explicit: config parsing loads rules, Tochka normalization handles family-specific field extraction, and preview classification consumes boolean outcomes.
- Preserve strict TypeScript typing for the newly supported family shapes and avoid broad `any`-based access for RS or arrival records.
- Keep transfer handling out of scope: do not add pairing, mirrored-leg reconciliation, or canonical transfer output in this change.
- Validate the rollout with focused tests plus `npm run check`, and keep all new files aligned with the existing Biome and TypeScript style baseline.