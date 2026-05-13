## Context

The current preview pipeline for Tochka records was introduced as a narrow income/expense slice and uses a single `identified` flag as the main decision output. That flag is no longer expressive enough once the preview needs to say both "we recognized this record" and "we intentionally do not want to keep it for future Honey Money save handling".

`CardTransactionInfo` is the right first slice because it already participates in the existing preview logic and includes both real financial events and technical noise such as canceled purchases and card verification checks.

## Goals / Non-Goals

**Goals:**
- Define a preview classification contract with `identified`, `save`, and `reason`.
- Drive known type-code decisions from source configuration instead of hardcoding all `CardTransactionInfo` cases.
- Support three preview outcomes only:
  - identified and save
  - identified and excluded from save
  - not identified
- Make included/excluded ambiguity explicit as a classification failure.

**Non-Goals:**
- Calling the Honey Money API.
- Introducing a separate runtime state for save-time failures.
- Solving transfer ownership or pairing logic in this change.
- Generalizing every Tochka type in one pass.

## Decisions

### Decision: Preview classification uses three fields
Each preview record will expose:
- `identified`: whether the classifier reached an unambiguous decision for the record
- `save`: whether the record should remain eligible for future Honey Money save handling
- `reason`: `null` for save-ready identified records, `excluded` for intentionally skipped identified records, or a short failure reason for not-identified records

Rationale:
- Separates recognition from retention.
- Keeps preview output simple while still covering all current classification states.
- Avoids introducing save-time concerns before the write path is in scope.

### Decision: Known type-codes use config-driven included/excluded conditions
The Tochka source configuration will define a `type_codes` dictionary where each known type-code may declare `included` and `excluded` condition arrays. Each condition is a flat object of source field/value matches, for example `{ "tranCode": "Purchase", "status": "Withdraw" }`.

Rationale:
- Makes preview classification auditable and adjustable without changing code for every case.
- Fits the immediate `CardTransactionInfo` need.
- Creates a reusable mechanism for later transaction families.

### Decision: Included and excluded matches must be mutually exclusive
If a record matches both an `included` and an `excluded` condition, the classifier must treat the record as not identified with reason `included/excluded ambiguity`.

Rationale:
- Prevents hidden precedence rules in configuration.
- Surfaces configuration defects directly in preview output.
- Matches the intended discipline that rule sets are authored to be mutually exclusive.

### Decision: First implementation scope is Tochka CardTransactionInfo only
The initial rule dictionary will be used for `CardTransactionInfo` records. The expected first cases are:
- include purchase-like card transactions in supported financial statuses
- exclude `CheckCard`
- exclude canceled purchases

Rationale:
- Keeps the change small and testable.
- Reuses an existing preview surface where the current model is already too narrow.
- Avoids mixing this contract change with transfer-family classification.

## Risks / Trade-offs

- [Risk] Source configuration can become inconsistent. -> Mitigation: validate the structure at load time and expose ambiguity at preview time.
- [Risk] A known type-code with no matching condition may surprise operators. -> Mitigation: return `identified=false` with an explicit reason instead of silently dropping the record.
- [Risk] Reusing a single `reason` string can limit diagnostics later. -> Mitigation: keep the first contract intentionally small and extend only when a concrete need appears.

## Migration Plan

No production migration is required. The change updates preview-only classification semantics and source configuration.

Implementation rollout:
1. Extend preview output types with `save` and `reason` semantics.
2. Add config parsing/validation for source `type_codes` condition dictionaries.
3. Apply the rule engine to Tochka `CardTransactionInfo` classification.
4. Update focused preview tests and fixture coverage.

## Open Questions

- Should later changes standardize a finite enum for `reason`, or keep it as free text?
- Should sources without `type_codes` configuration remain on bespoke logic until migrated?
