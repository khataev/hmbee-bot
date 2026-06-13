## 1. CLI Flag Registration

- [ ] 1.1 Add `--only-errors` boolean option to the `apply` command in `src/index.ts`

## 2. Preview Filter Implementation

- [ ] 2.1 In the `--preview` branch of `src/index.ts`, after `previewRecords` is built, apply `--only-errors` filter: keep only records where `!r.identified || !r.save`
- [ ] 2.2 Update the informational summary message to include total record count and filtered error count when `--only-errors` is active

## 3. Validation

- [ ] 3.1 Run `npm run check` and confirm it passes with no errors
