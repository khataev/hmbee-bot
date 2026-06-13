## 1. CLI Flag Registration

- [x] 1.1 Add `--only-errors` boolean option to the `apply` command in `src/index.ts`

## 2. Preview Filter Implementation

- [x] 2.1 In the `--preview` branch of `src/index.ts`, after `previewRecords` is built, apply `--only-errors` filter: keep only records where `!r.identified || !r.save`
- [x] 2.2 Update the informational summary message to include total record count and filtered error count when `--only-errors` is active

## 3. Replace --quiet with --verbose (invert verbosity default)

- [x] 3.1 Remove `--quiet` option from `sync` and `apply` commands in `src/index.ts`
- [x] 3.2 Add `--verbose` boolean option to both commands
- [x] 3.3 Invert all `isQuiet` guards: informational messages are suppressed by default and shown only when `options.verbose` is true
- [x] 3.4 Run `npm run check` and confirm it passes with no errors

## 4. Validation

- [x] 4.1 Run `npm run check` and confirm it passes with no errors
