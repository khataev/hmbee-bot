# Technical Debt

## Summary
Tracking identified technical debt and planned simplifications.

## Items

### 1. Simplify sync output format
- **Context**: Currently `sync` command supports `--format <type>` (adapted|raw).
- **Goal**: Deprecate and remove `raw` format, making `adapted` the only supported and default behavior.
- **Why**: Reduces complexity in pipeline interpretation and simplifies consumer logic.
- **Status**: Added 2026-05-10.
