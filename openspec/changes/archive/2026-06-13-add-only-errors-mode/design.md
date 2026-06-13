## Context

The `apply <source> --preview` command normalizes Tochka source records and emits the full list to stdout. Each record carries `identified`, `save`, and `reason` fields that encode classification outcome. Recent work added `save=false` / `reason="Category is missing..."` for income/expense records without a resolved category.

Currently, operators must inspect every record in the output to find problematic ones. Adding `--only-errors` gives an immediate filtered view of the records that need attention.

## Goals / Non-Goals

**Goals:**
- Add `--only-errors` boolean flag to `apply <source> --preview`.
- When the flag is active, filter preview output to records where `identified = false` OR `save = false`.
- Preserve accurate counts in informational messages.
- Replace `--quiet` with `--verbose` on `sync` and `apply`: quiet is now the default, informational output is opt-in.

**Non-Goals:**
- `--only-errors` is meaningless outside `--preview` mode; it is ignored when used without `--preview`.
- No changes to normalization, mapping, identification, or Honey Money apply logic.
- No new output formats.

## Decisions

### Filter location: post-normalization in `src/index.ts`

All classification already happens inside `normalizeTochkaRecord`. The filter is a pure array filter step immediately after normalization and before `writeOutput`, scoped entirely to the preview branch in `src/index.ts`.

**Alternative considered:** push the filter into a dedicated helper or into the loader — rejected because it adds indirection for trivial logic that belongs at the command layer.

### Flag name and type: `--only-errors` boolean option

Commander registers it as `.option('--only-errors', ...)` — reads as `options.onlyErrors` (camelCase). Boolean flags require no argument, consistent with existing `--preview` and `--verbose`.

### Verbosity: replace `--quiet` with `--verbose`, invert default

Currently `sync` and `apply` are verbose by default, with `--quiet` to suppress informational messages. This is non-standard CLI ergonomics — scripts that capture stdout receive noise by default.

The change removes `--quiet` and adds `--verbose`. All `isQuiet` guards in `src/index.ts` are replaced by `isVerbose = options.verbose ?? false`. Informational messages (`console.error(...)`) are gated on `isVerbose` instead of `!isQuiet`.

**Alternative considered:** keep `--quiet` and add `--verbose` as an alias — rejected because two flags with inverted semantics is confusing and both are currently undocumented outside CLI help.

**Breaking change**: scripts that previously relied on the default verbose output will need to add `--verbose`. Scripts using `--quiet` must drop the flag (it has no effect after removal and Commander will error on unknown options). This is acceptable given the tool is operator-only.

### Count reporting

The informational message after the filter should report both total loaded records and how many errors were found, e.g.:
`✓ Preview complete. Processed 42 records. Showing 3 error records.`

This gives the operator full context without having to rerun without the flag.

## Engineering Constraints

- **Type safety**: the filter predicate `(r) => !r.identified || !r.save` operates on `PreviewRecord` — both fields are `boolean`, so no casting needed. TypeScript strict mode is satisfied without additional type guards.
- **Module boundaries**: no new modules. The change touches only `src/index.ts` (option registration, filter step, verbosity guards). No imports added.
- **Style / lint**: single-line filter expression; `biome` will format it without issue. `npm run check` must pass before done.

## Risks / Trade-offs

- [Flag without `--preview`] Using `--only-errors` without `--preview` silently has no effect. → Acceptable; a warning can be added later if needed.
- [Empty output] When all records are save-ready, the filtered list is empty — `writeOutput([])` emits `[]`. Correct and expected.
- [Breaking `--quiet` removal] Existing scripts relying on `--quiet` will error on the unknown option after the change. → Acceptable; the tool is operator-only and the flag is undocumented.

## Migration Plan

- Remove `--quiet` from both commands; add `--verbose`.
- Update any existing operator scripts or documentation that use `--quiet` to drop the flag (or add `--verbose` if verbose output is desired).
- No data migration, no schema changes.
