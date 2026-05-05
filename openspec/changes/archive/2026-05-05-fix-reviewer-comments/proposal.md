## Why

The first Tochka source-sync implementation works functionally, but code review found gaps in security resilience, typing strictness, and maintainability that conflict with the adopted style guide. This change addresses those issues now so subsequent source work builds on a safe and stable baseline.

## What Changes

- Harden Tochka authentication request handling by improving CSRF token extraction from cookie data and reducing accidental sensitive data exposure in error paths and output.
- Strengthen `TochkaTimelineResponseSchema` to use explicit transaction field typing derived from available sample payloads instead of broad `unknown` arrays.
- Improve operator-facing validation and error messages for missing required environment variables to make setup failures actionable.
- Replace fragile adapter internals (magic values and weak request ID generation) with named constants and `crypto.randomUUID()`.
- Add adapter-specific error classification for upstream HTTP failures to improve diagnostics and future retry handling.
- Keep CLI behavior and public command surface backward compatible.
- Validate quality gates with `npm run check` (TypeScript + Biome checks) before marking implementation complete.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `source-sync`: Tighten security, validation, and response-shape requirements for Tochka synchronization while preserving existing CLI sync behavior.

## Impact

- Affected code: `src/adapters/tochka.ts`, shared adapter types as needed, and related CLI error messaging paths.
- Affected specs: delta spec under `openspec/changes/fix-reviewer-comments/specs/source-sync/spec.md`.
- Dependencies: no new runtime package dependencies expected; use built-in Node.js `crypto` API.
- Quality/verification: `npm run check` and targeted sync command smoke checks against local sample/fixture flows.
