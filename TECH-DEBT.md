# Technical Debt

## Summary
Tracking identified technical debt and planned simplifications.

## Items

### 1. Simplify sync output format
- **Context**: Currently `sync` command supports `--format <type>` (adapted|raw).
- **Goal**: Deprecate and remove `raw` format, making `adapted` the only supported and default behavior.
- **Why**: Reduces complexity in pipeline interpretation and simplifies consumer logic.
- **Status**: Added 2026-05-10.

### 2. Standardize `sync` output and remove `--out` flag
- **Context**: The `sync` command currently allows a custom output path via `--out`.
- **Goal**: 
    - Remove the `--out` flag.
    - Standardize output path to `sync/[source]/[from]_[to].json` by default.
- **Why**: Ensures predictable file discovery for the `apply` command and reduces operator decision overhead.
- **Status**: Added 2026-05-10.
