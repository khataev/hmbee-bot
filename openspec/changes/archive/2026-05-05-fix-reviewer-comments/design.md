## Context

The initial Tochka adapter and CLI integration are functional and already aligned with the MVP flow, but review feedback identified critical hardening work before scaling source integrations. The gaps are concentrated in secure request construction, CSRF extraction robustness, schema precision, and maintainability of adapter internals.

This design targets only internal quality and reliability improvements while preserving the current CLI command contract and operator workflow for `source-sync`.

## Goals / Non-Goals

**Goals:**
- Make cookie and CSRF handling resilient to common cookie-string variations and avoid leaking sensitive values in user-visible errors.
- Replace broad `unknown` timeline typing with explicit schema-driven typing for core transaction fields.
- Standardize Tochka adapter constants and request ID generation (`crypto.randomUUID()`) for predictable behavior.
- Introduce adapter-specific error taxonomy for upstream failures and local validation failures.
- Preserve backward-compatible CLI behavior while improving setup guidance and diagnostics.

**Non-Goals:**
- Replacing the manual session-based authentication model.
- Adding retry/backoff orchestration or background sync scheduling.
- Changing existing command names, required flags, or output format defaults.
- Introducing new runtime dependencies outside existing Node.js/TypeScript ecosystem.

## Decisions

1. Cookie/CSRF extraction via deterministic parser utility
- Decision: implement a small parser to split cookie pairs and locate `X-CSRF-TOKEN` by key, with decode support where needed.
- Rationale: regex extraction over a full cookie string is brittle and fails silently on formatting changes.
- Alternative considered: keep regex but harden expression. Rejected due to ongoing fragility and lower readability.

2. Introduce `TochkaError` hierarchy for adapter failures
- Decision: create adapter error class(es) that distinguish validation errors, auth/session errors, and upstream transport/status failures.
- Rationale: improves operator-facing diagnostics and enables future policy (retry/alerting) without refactoring call sites.
- Alternative considered: keep generic `Error` strings. Rejected because it weakens troubleshooting and violates style guidance for clear CLI failures.

3. Upgrade timeline schema from unknown array to explicit transaction model
- Decision: define Zod object schema for timeline entries using stable fields present in fixture payloads and safely pass through unknown extras when needed.
- Rationale: strict typing reduces runtime surprises and enforces contract quality under TypeScript strict mode.
- Alternative considered: partial typing with `z.unknown()` leafs. Rejected because it does not address the reviewed weak-typing concern.

4. Move magic values to named constants in adapter module
- Decision: centralize page size and static HTTP header defaults in top-level constants (or dedicated adapter config block).
- Rationale: improves maintainability, discoverability, and consistency.
- Alternative considered: keep inline literals. Rejected due to repeated maintenance risk.

5. Use `crypto.randomUUID()` for RPC/request IDs
- Decision: replace random substring generator with UUID generation from Node.js runtime.
- Rationale: predictable uniqueness properties and modern platform-native API.
- Alternative considered: external UUID package. Rejected to avoid extra dependency overhead.

## Engineering Constraints

- Type safety: no `any`; all parsed external payloads MUST be validated through explicit Zod schemas before use.
- Error handling: thrown errors crossing adapter boundaries MUST be typed/classified and user-facing messages MUST not contain raw cookie/session values.
- Module boundaries: source-specific parsing/request details stay in `src/adapters/tochka.ts` (and companion adapter files), while shared CLI formatting remains outside adapter internals.
- Quality gates: `npm run check` MUST pass after implementation (TypeScript strict checks and Biome lint/format checks).
- Style/lint impact: if new helper modules are introduced, they MUST follow STYLEGUIDE naming and import conventions and remain Biome-clean without disabling rules.

## Risks / Trade-offs

- [Fixture drift] Strict schema may reject unseen but valid payload variants -> Mitigation: model known stable fields as required and keep optional/nullable handling for volatile fields.
- [Auth flow fragility] Manual session model can still expire unexpectedly -> Mitigation: classify auth failures clearly and provide actionable setup/re-auth guidance.
- [Scope creep] Error taxonomy may expand beyond current need -> Mitigation: start with minimal, well-scoped categories used by current adapter call paths.

## Migration Plan

1. Implement parser/error/schema/constant updates in Tochka adapter internals behind existing command flow.
2. Keep command contract unchanged and verify output paths/formats still match current behavior.
3. Run `npm run check` and adapter smoke tests with fixture-backed scenarios.
4. If regressions appear, rollback by reverting adapter-internal changes while retaining spec/task artifacts for iterative re-apply.

## Open Questions

- Which timeline fields should be strictly required vs optional to balance safety and payload tolerance?
- Should CSRF extraction support URL-decoded values only, or both raw and decoded token comparisons?
- Do we want to standardize `TochkaError` into a reusable cross-adapter base now or defer until second source adapter lands?
