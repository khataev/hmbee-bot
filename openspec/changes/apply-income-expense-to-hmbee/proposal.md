## Why

The preview-only Honey Money flow is already useful for inspection, but it still leaves the operator with manual copy-and-save work. The next step is to turn the synchronized Tochka records into save-ready Honey Money transaction drafts and let the CLI persist identified income and expense transactions directly.

This change is needed now because the repository has already moved into the apply stage. We need a documented contract for amount normalization, account mapping, Honey Money write credentials, and created transaction identifier capture before SQLite persistence and rerun safety are added in a later change.

## What Changes

- Expand the `hmbee` branch produced by `apply --preview` into the full Honey Money transaction draft used for writes.
- Add a final amount normalization step that rounds Tochka source amounts to the Honey Money integer amount shape and applies the correct sign for income and expense records.
- Add the non-preview `apply <source>` flow that sends identified Tochka income and expense records from synchronized files to Honey Money.
- Save only identified transactions by default and add `--only-id` to limit a run to an explicit comma-separated subset of source transaction identifiers.
- Resolve Honey Money account identifiers for Tochka records through local configuration and fail fast when a required mapping is missing.
- Capture and print created Honey Money transaction identifiers from API responses without introducing local persistence in this change.
- Keep transfer handling and SQLite-backed deduplication out of scope for this change.
- Validate the change with focused automated tests, `npm run typecheck`, and repository quality checks via `npm run check`.

## Capabilities

### New Capabilities
- `source-apply`: Build save-ready Honey Money drafts from synchronized source records and apply identified income and expense transactions to Honey Money under operator control.

### Modified Capabilities
- `secure-config-management`: Extend local configuration rules to cover Honey Money write credentials and Tochka-to-Honey-Money account mapping resolution.

## Impact

- Affected code: CLI apply orchestration, preview-to-draft shaping, Honey Money client integration, environment validation, configuration loading, and focused test helpers.
- Affected configuration: `.env` / `.env.example` for Honey Money secrets and `config/sources.json` for Tochka account to Honey Money account mappings.
- Affected operator workflow: `apply --preview` now shows a full Honey Money draft, and `apply` can persist either all identified records or a targeted subset via `--only-id`.
- Affected external API usage: Honey Money `POST /transaction` requests and response parsing for created transaction ids.
- Quality and maintainability constraints: preserve strict typing across draft construction and apply filtering, keep secret values out of errors, and keep validation covered by focused tests plus `npm run check`.