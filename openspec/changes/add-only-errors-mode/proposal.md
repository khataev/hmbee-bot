## Why

When previewing a batch of Tochka source records, the operator needs to quickly spot records that won't be saved — either because they weren't identified or because they failed a save check (e.g. missing category). Scrolling through a full list to find the problematic entries is tedious and error-prone, especially as batch sizes grow.

## What Changes

- Add a `--only-errors` flag to the `apply <source> --preview` command.
- When the flag is active, the preview output list is filtered to include only records where `identified = false` OR `save = false`.
- Records that are fully save-ready (`identified = true` AND `save = true`) are excluded from the filtered output.
- All other preview behaviour (normalization, mapping, formatting) remains unchanged.

## Capabilities

### New Capabilities

- `source-preview-error-filter`: CLI modifier that restricts preview output to error records (`identified=false OR save=false`) to allow focused operator review.

### Modified Capabilities

- `source-preview`: The `--only-errors` flag extends the existing preview flow with an output filter step. No requirement changes to identification or save logic — only the output selection changes.

## Impact

- CLI command definition: new `--only-errors` boolean option on the `apply` command (preview branch).
- Preview output pipeline: add a post-classification filter step when the flag is set.
- No changes to normalization, mapping, or Honey Money write logic.
- No new dependencies.
