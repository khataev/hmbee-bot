## 1. Security and Request Construction Hardening

- [x] 1.1 Replace regex CSRF extraction with deterministic cookie key/value parsing utility in Tochka adapter.
- [x] 1.2 Prevent sensitive cookie/session data from appearing in thrown errors or operator-facing diagnostics.
- [x] 1.3 Replace ad-hoc RPC ID generation with `crypto.randomUUID()` and move hardcoded request literals into named constants.
- [x] 1.4 Run `npm run check` after request-construction changes and resolve all TypeScript/Biome issues.

## 2. Schema Typing and Error Classification

- [x] 2.1 Define explicit Zod schema for Tochka timeline transactions (required and optional fields from fixture-backed payloads).
- [x] 2.2 Replace broad `z.array(z.unknown())` usage with typed schema parsing in adapter mapping flow.
- [x] 2.3 Add `TochkaError` classification for validation, authentication/session, and upstream HTTP failures.
- [x] 2.4 Run `npm run check` after schema/error changes and resolve all TypeScript/Biome issues.

## 3. CLI Validation Messaging and Regression Verification

- [x] 3.1 Improve missing env var validation errors to include actionable setup guidance (for example, local `.env` remediation hints).
- [x] 3.2 Verify sync command behavior remains backward compatible for source selection and output controls.
- [x] 3.3 Execute fixture-based smoke checks for Tochka timeline fetch path and confirm classified error outputs for failure cases.
- [x] 3.4 Run final `npm run check` and ensure no lint/type/style regressions before closing change.
