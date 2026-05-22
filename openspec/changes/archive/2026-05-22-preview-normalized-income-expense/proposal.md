## Why

The next Honey Money integration step needs an operator-visible preview before any write operations are added. A preview-first change reduces risk by making source parsing, transaction identification, and category mapping inspectable against synchronized Tochka files before Honey Money save logic and local persistence are introduced.

This change also introduces the project test runner baseline. Parsing and normalization rules for income and expense records will evolve quickly, so adding `vitest` now creates a maintainable way to validate behavior and keep future review cycles focused.

## What Changes

- Add an `apply <source> --preview` CLI flow for reading synchronized source files from `sync/<source>`.
- Parse Tochka synchronized records for income and expense flows only, excluding transfer handling from this change.
- Filter Tochka records to supported statuses for preview (`Withdraw`, `InProgress`) and mark unsupported records as not identified.
- Introduce a normalized internal representation for preview output.
- Add a separate `hmbee` branch in preview output for Honey Money-oriented fields, starting with mapped category output.
- Add source-specific category mapping support used by the Tochka preview flow.
- Add `vitest` and the initial test setup for normalization and mapping behavior.
- Validate quality gates with `npm run check` and the new focused test command before marking the change complete.

## Capabilities

### New Capabilities
- `source-preview`: Preview normalized source records and Honey Money-oriented mapping output from synchronized source files before any Honey Money write is attempted.

### Modified Capabilities
- None.

## Impact

- Affected code: CLI command handling in `src/`, Tochka adapter logic, new preview normalization/mapping modules, and output formatting.
- Affected project tooling: `package.json`, test configuration, and related development scripts for `vitest`.
- Affected inputs: synchronized files stored under `sync/<source>` and source-specific category mapping configuration.
- Quality and maintainability constraints: preserve strict typing, validate external input boundaries, and keep parsing/mapping behavior covered by focused automated tests plus `npm run check`.
