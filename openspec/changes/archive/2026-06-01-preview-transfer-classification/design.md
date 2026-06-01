## Context

Tochka preview currently supports card transactions, the first SBP income/expense slice, `PaymentWrittenOff`, and `VedPaymentIncome`, but it does not yet model the remaining transfer-focused RS scenarios consistently. The missing cases are not all the same shape: ordinary own-to-own transfers are represented as mirrored `PaymentAccepted` and `PaymentIncome` records, deposit opening is represented as `PaymentWrittenOff`, deposit principal return is represented as `PaymentIncome`, and deposit interest is a separate incoming `PaymentIncome` that must remain income rather than transfer duplicate.

The implementation already uses config-driven JSON-logic predicates for type-code classification and exposes `identified`, `save`, and `reason`. That existing mechanism should remain the primary classifier surface. The only new source-specific heuristic needed for this change is recognition of Tochka auto-opened deposit accounts, which are not stable enough to maintain in `accountMappings` and can instead be identified by account prefix `421` together with Tochka BIC `044525104`.

## Goals / Non-Goals

**Goals:**
- Support transfer preview for the remaining validated Tochka cases without introducing a separate ownership model.
- Keep one canonical save-ready record for each supported transfer scenario and mark only mirrored duplicates as `excluded`.
- Represent supported transfers as a distinct normalized transaction type rather than reusing ordinary income or expense types.
- Carry the counterparty account identifier in normalized transfer records when the opposite owned account is resolved.
- Reuse config-driven predicates as the primary classification mechanism.
- Extend preview context with enough owned-account semantics to classify cross-source owned accounts and Tochka deposit accounts.
- Preserve existing non-transfer income/expense preview behavior outside the transfer-specific additions.

**Non-Goals:**
- Changing Honey Money apply behavior or API payload semantics.
- Adding a generic bank-agnostic heuristic for temporary accounts beyond the validated Tochka `421*` deposit pattern.
- Solving every possible Tochka banking product outside the observed transfer, deposit principal, and deposit interest scenarios.
- Introducing cross-record pairing or stateful matching logic.

## Decisions

### Decision: Keep classification single-record and choose canonical saved legs by type and account shape
The classifier will continue to make decisions from a single source record. Canonical record selection is encoded in rules rather than through record pairing.

Rationale:
- The observed transfer shapes already carry both source and destination account identifiers in each record.
- This avoids adding stateful matching logic to preview.
- It keeps the `included`/`excluded` contract aligned with the existing JSON-logic rule engine.

Alternatives considered:
- Pair `PaymentAccepted` with `PaymentIncome` by `activityId`, `corebankingId`, and `sum`. Rejected because it adds multi-record logic without improving the validated scenarios.

### Decision: Owned-account semantics combine configured registry and a Tochka deposit heuristic
The preview rule context will expose an owned-account registry built from all configured `accountMappings` across all sources. It will also expose a Tochka-specific predicate for deposit-like accounts: account number prefix `421` plus Tochka BIC `044525104`.

Rationale:
- Cross-bank own-account SBP transfer detection needs one shared registry rather than a source-local list.
- Tochka deposit accounts are auto-opened and ephemeral, so maintaining them in configuration is operationally poor.
- The `421*` plus Tochka BIC heuristic matches the observed deposit opening and principal return records while excluding ordinary incoming income.

Alternatives considered:
- Add every deposit account to configuration. Rejected because the accounts are one-off and auto-closed.
- Use Tochka BIC alone as ownership proof. Rejected because bank-owned counterparty accounts such as deposit interest payout records also carry Tochka BIC.

### Decision: Canonical transfer legs are type-specific
The classifier will treat these records as the saved canonical records:
- `PaymentAccepted` for ordinary own-to-own internal transfers between configured owned accounts.
- `PaymentWrittenOff` for deposit opening.
- `PaymentIncome` for deposit principal return.
- `SbpB2CPayment` for transfers from Tochka to an owned external account.

The mirrored `PaymentIncome` leg of an ordinary own-to-own internal transfer is identified but excluded.

Rationale:
- This aligns with the observed data shapes and avoids saving duplicate records for one business transfer.
- Deposit opening and principal return are not mirrored duplicates of `PaymentAccepted`, so they remain save-ready.

Alternatives considered:
- Exclude all own-to-own `PaymentIncome` records. Rejected because it would incorrectly exclude deposit principal return.

### Decision: Normalized transfer records use a dedicated type and require the opposite account identifier
Supported transfer records will be normalized as `type = transfer` rather than being represented as ordinary income or expense. The normalized model may keep `counterpartyAccountId` optional at the top level, but every normalized record with `type = transfer` must include `counterpartyAccountId` so the opposite owned account is preserved for downstream transfer mapping.

Rationale:
- The user wants transfers to be semantically distinct from existing income and expense records in preview output.
- The downstream Honey Money transfer payload uses explicit from/to account identifiers, so preview needs to preserve which owned account is on the opposite leg.
- Keeping this field in the normalized record makes transfer meaning inspectable without recomputing the account match from raw source data.
- Making the field mandatory for `type = transfer` keeps the transfer shape precise without forcing unrelated normalized record types to carry transfer-only data.

Alternatives considered:
- Keep transfers as ordinary income or expense and rely only on `save` behavior. Rejected because it loses an important business distinction in preview output.
- Keep the opposite account identifier only in the `hmbee` branch. Rejected because transfer semantics would then be split between normalized meaning and target-specific mapping.

### Decision: Deposit interest remains ordinary income, not transfer
A `PaymentIncome` record is treated as deposit interest income when the destination account is owned, the payer is neither in the configured owned-account registry nor deposit-like by the Tochka `421*` heuristic, and the record otherwise matches the validated income shape.

Rationale:
- In observed data, principal return comes from `421*` Tochka deposit accounts while interest does not.
- This keeps transfer semantics narrow and avoids using fragile purpose-text parsing as the primary discriminator.

Alternatives considered:
- Distinguish principal vs interest by `purpose` text. Rejected for the first implementation because the structural account-based distinction is already sufficient in observed data.

## Engineering Constraints

- Type safety: extend preview record types for `PaymentAccepted` and `PaymentIncome` explicitly instead of widening to loose `unknown` access patterns.
- Type safety: introduce the normalized transfer shape explicitly, including a typed `counterpartyAccountId` field that is required for `type = transfer` and absent for non-transfer normalized records.
- Error handling: unsupported or partially matched transfer shapes must continue to return deterministic preview results with `identified`, `save`, and `reason`; malformed rules must not crash preview execution.
- Module boundaries: keep source-shape parsing in Tochka preview normalization, keep JSON-logic evaluation in the existing rule engine boundary, and keep config parsing in `src/config.ts` without embedding CLI concerns there.
- Style and lint impact: any helper introduced for owned-account or deposit-account semantics must follow existing TypeScript strictness and Biome formatting rules; no new dependency is required.

## Risks / Trade-offs

- [Risk] The `421*` heuristic is Tochka-specific and may not generalize to future products. → Mitigation: scope it explicitly to this change and to Tochka BIC `044525104`.
- [Risk] A future bank-owned Tochka account could also begin with `421` while not representing a customer deposit. → Mitigation: keep the heuristic local to validated transfer scenarios and cover it with fixture-backed tests.
- [Risk] Single-record canonical selection could miss a future case where only the mirrored leg has the necessary context. → Mitigation: document this as a non-goal and revisit only if observed data disproves the assumption.
- [Risk] Reusing the same preview pipeline for transfer and non-transfer flows can blur capability boundaries. → Mitigation: specify transfer scenarios explicitly in the delta spec and preserve non-transfer behavior unchanged.

## Migration Plan

1. Extend OpenSpec requirements for transfer preview semantics, owned-account registry behavior, and Tochka deposit-account heuristic.
2. Update config loading to expose a combined cross-source owned-account registry to preview normalization.
3. Extend Tochka preview type support for `PaymentAccepted` and `PaymentIncome`.
4. Add rule-context helpers for configured owned accounts and Tochka deposit-like accounts.
5. Update transfer-related type-code predicates and normalization logic to reflect canonical saved legs.
6. Extend normalized preview output so supported transfers emit `type = transfer` and always include `counterpartyAccountId`.
7. Add focused tests for internal transfer canonicalization, deposit opening, deposit principal return, deposit interest, and owned-external `SbpB2CPayment`.
8. Validate with focused tests and `npm run check`.

Rollback is straightforward because the change is preview-only: revert the classifier and config-loading changes and restore the prior spec state.

## Open Questions

- None at the moment.
