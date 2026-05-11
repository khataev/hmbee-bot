## Why

The current Tochka transaction mapping in `src/preview/tochka.ts` is limited and manual. We need to expand it using the updated mapping data from `tochka_mapping.txt` to ensure more transactions are correctly categorized in Honey Money.

## What Changes

- Update `mapTochkaCategory` in `src/preview/tochka.ts` to include all MCC and title-based mappings from `tochka_mapping.txt`.
- Implement Title-based mapping as a primary or secondary check (consistent with the provided mapping file).
- Ensure the mapping logic remains performant and maintainable.

## Capabilities

### Modified Capabilities
- `source-preview`: Update the Tochka record normalization logic to support a wider range of MCCs and title-based category mapping.

## Impact

- `src/preview/tochka.ts`: The `mapTochkaCategory` function will be significantly expanded.
- Preview accuracy for Tochka transactions will improve.
