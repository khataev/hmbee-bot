## Why

The current preview model overloads `identified` with two different meanings: whether the system recognized a record shape and whether that record should move forward for future Honey Money handling. This makes excluded records such as canceled card transactions and card verification holds look the same as genuinely unclassified records.

The next preview step should make classification outcomes explicit before transfer handling expands. Starting with `CardTransactionInfo` keeps the change narrow while establishing a reusable contract for later Tochka transaction families.

## What Changes

- Refine preview classification output to use three explicit outcomes through `identified`, `save`, and `reason`.
- Add source-configured type-code conditions so known record families can classify records through `included` and `excluded` rule sets.
- Apply the new rule model first to Tochka `CardTransactionInfo` records.
- Treat ambiguous rule matches as not identified rather than silently preferring one branch.
- Keep transfer ownership logic out of this change beyond the existing account registry assumptions.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `source-preview`: Preview classification distinguishes save-ready, intentionally excluded, and not-identified records through explicit decision fields and source-configured type-code rules.

## Impact

- Affected code: Tochka preview normalization, preview record types, config loading/validation, and focused preview tests.
- Affected inputs: `config/sources.json` gains source-level `type_codes` rule dictionaries used during preview classification.
- Affected output contract: preview records now carry both `identified` and `save`, with `reason` populated for excluded or not-identified outcomes.
- Quality constraints: rule matching must remain deterministic, config-driven, and covered by focused tests plus `npm run check`.
