## Why

The `sync` command currently allows a custom output path via the `--out` flag, which leads to inconsistent file locations and makes it difficult for the `apply` command to automatically discover synchronization data. Standardizing the output path ensures predictable file discovery and reduces operational overhead.

## What Changes

- Remove the `--out` flag from the `sync` command.
- Standardize the default output path to `sync/[source]/[from]_[to].json`.
- Automatically create the necessary directory structure (`sync/[source]/`) if it doesn't exist.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `source-sync`: Update the `sync` command requirements to enforce a standardized output path and remove the manual output flag.

## Impact

- `src/index.ts`: CLI command definition (remove `--out` flag).
- `src/adapters/types.ts` or similar: Update sync function signatures if they depend on manual paths.
- Implementation of the file saving logic to use the new naming convention.
