## 1. Test Baseline

- [x] 1.1 Add `vitest` and the minimal project test configuration/scripts for focused preview tests
- [x] 1.2 Add an initial fixture-driven test file covering the preview pipeline entry behavior
- [x] 1.3 Validate the test baseline with `npm run check`

## 2. Preview Command and Input Loading

- [x] 2.1 Add the `apply <source> --preview` CLI command surface and source selection flow
- [x] 2.2 Implement synchronized file discovery and loading from `sync/<source>` for preview input
- [x] 2.3 Validate preview command wiring and file-loading changes with `npm run check`

## 3. Normalized Preview Representation

- [x] 3.1 Implement Tochka preview parsing for income and expense records only, including supported status handling for `Withdraw` and `InProgress`
- [x] 3.2 Emit the normalized preview representation and preserve not-identified records for unsupported source shapes or statuses
- [x] 3.3 Add focused tests for normalization, identification, and status filtering behavior
- [x] 3.4 Validate normalized preview behavior with `npm run check`

## 4. Honey Money Preview Branch and Mapping

- [x] 4.1 Add the separate `hmbee` branch to preview output and populate the initial mapped category field
- [x] 4.2 Implement Tochka-specific category mapping via MCC and Description in code (Technical Debt: move to config later)
- [x] 4.3 Add focused tests for category mapping and preview output shaping
- [x] 4.4 Validate mapping and preview output changes with `npm run check`

## 5. Robustness and Schema refinement

- [x] 5.1 Refactor `PreviewRecord` to move `identified` to the root and remove it from `NormalizedRecord`
- [x] 5.2 Implement error-safe parsing with `try-catch` to avoid crashes on malformed data
- [x] 5.3 Ensure `sourceRecord` is always preserved in the output regardless of identification success

## 6. Documentation and Final Verification

- [x] 6.1 Document how to run `apply <source> --preview` against synchronized files and how preview output is structured
- [x] 6.2 Run final verification with `npm run check` and the focused preview test command
