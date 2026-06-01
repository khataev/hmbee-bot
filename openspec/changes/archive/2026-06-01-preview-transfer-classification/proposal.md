## Why

Tochka preview classification now covers ordinary income and expense slices, but transfer records remain split across unsupported RS types, partially supported SBP types, and deposit-specific shapes. This makes preview output inconsistent: mirrored internal transfer legs are not normalized under one policy, deposit opening and principal return are not represented as transfer-ready records, and transfer detection still relies on incomplete account ownership semantics.

This change is needed now because the non-transfer income/expense slice is already in place, and the remaining gap is specifically transfer preview behavior. The next implementation step needs a single contract for which transfer records are save-ready, which mirrored legs are intentionally excluded, and how Tochka deposit accounts are recognized without introducing a full ownership model.

## What Changes

- Extend Tochka preview classification to support the remaining transfer-oriented RS record families: `PaymentAccepted`, `PaymentIncome`, and transfer-oriented `PaymentWrittenOff`.
- Define canonical transfer-leg behavior so preview saves the intended record for each supported transfer scenario and excludes only duplicated mirrored legs.
- Extend the normalized preview model so transfer records use a distinct normalized `transfer` type instead of being folded into ordinary income or expense types.
- Include the counterparty account identifier in normalized transfer records so the opposite owned account can be carried through preview and later mapped to Honey Money transfer fields.
- Use a unified owned-account registry built from all configured `accountMappings` across sources for cross-bank transfer detection.
- Add a Tochka-specific heuristic for auto-opened deposit accounts: accounts with prefix `421` and Tochka BIC `044525104` are treated as owned deposit-like accounts for preview transfer classification.
- Classify supported transfer scenarios through config-driven predicates plus the deposit-account heuristic, while keeping ordinary income/expense behavior outside this transfer-focused change.
- Preserve the explicit preview contract of `identified`, `save`, and `reason`, including `excluded` for duplicated mirrored transfer legs.
- Validate the change with focused preview tests and the existing repository quality gate via `npm run check`.

## Capabilities

### New Capabilities
- `tochka-transfer-preview`: Preview classification for supported Tochka transfer scenarios, including internal account transfers, deposit opening, deposit principal return, and owned external-account SBP transfers.

### Modified Capabilities
- `source-preview`: Extend preview requirements so Tochka transfer records have defined canonical save behavior, shared owned-account registry semantics, and Tochka deposit-account heuristics.

## Impact

- Affected code: Tochka preview normalization, normalized preview record shape, preview type support, config loading for cross-source account registry semantics, preview rule evaluation context, and focused preview tests.
- Affected inputs: `config/sources.json` remains the source of configured owned accounts; preview additionally applies a Tochka-specific `421*` deposit-account heuristic gated by Tochka BIC `044525104`.
- Affected outputs: preview records for supported transfer cases will now distinguish save-ready canonical transfer records from intentionally excluded mirrored duplicates, expose a dedicated normalized transfer type, and include the counterparty account identifier when resolved.
- Affected systems: CLI preview only; no Honey Money API or apply behavior changes are introduced by this change.
- Quality constraints: TypeScript strictness, Biome checks, focused preview tests, and `npm run check` remain required for completion.
