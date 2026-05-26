## 1. Preview Context

- [x] 1.1 Extend preview config loading to expose a shared owned-account registry across configured sources and validate the change with `npm run check`.
- [x] 1.2 Add Tochka-specific deposit-account helper logic for the `421*` plus `044525104` heuristic without widening module boundaries, and validate the change with `npm run check`.

## 2. Tochka Classification

- [x] 2.1 Extend Tochka preview type support and normalization for `PaymentAccepted` and `PaymentIncome`, including `corebankingId`-based identifiers, and validate the change with `npm run check`.
- [x] 2.2 Extend the normalized preview model so supported transfers emit `type = transfer` and require `counterpartyAccountId`, while non-transfer records remain valid without it, then validate the change with `npm run check`.
- [x] 2.3 Update transfer-related preview rule context and predicates so internal transfers, deposit opening, deposit principal return, and owned-external `SbpB2CPayment` use canonical save behavior, and validate the change with `npm run check`.
- [x] 2.4 Preserve ordinary income behavior for deposit interest and unmatched transfer-like records while keeping `identified`, `save`, and `reason` deterministic, and validate the change with `npm run check`.

## 3. Verification

- [x] 3.1 Add focused preview tests for internal transfer canonicalization, excluded mirrored `PaymentIncome`, deposit opening, deposit principal return, deposit interest, normalized `transfer` type, and `counterpartyAccountId`, then validate with `npm run check`.
- [x] 3.2 Add or update focused preview tests for owned-external `SbpB2CPayment` transfer handling and shared owned-account registry behavior, then validate with `npm run check`.
- [x] 3.3 Run the full repository quality gate with `npm run check` and confirm the transfer-preview change passes without introducing unrelated regressions.
