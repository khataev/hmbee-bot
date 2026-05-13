# Review Report: apply-income-expense-to-hmbee

Date: 2026-05-12
Reviewer: Senior code review (automated)

## Scope

- Change: apply-income-expense-to-hmbee
- Reviewed against team standards in STYLEGUIDE.md
- Reviewed files changed on branch HMB-9-apply-income-expense-to-hmbee vs master
- Dependency audit: npm audit

## Findings

### 🔴 CRITICAL

- None.
- Dependency audit result: 0 vulnerabilities (info: 0, low: 0, moderate: 0, high: 0, critical: 0).
- No hardcoded secrets/tokens/cookies were found in source files under src/ (including src/adapters/).

### 🟡 WARNING

1. Missing runtime validation at file-input boundary
- Location: src/preview/loader.ts:9, src/preview/loader.ts:34
- Issue: Data loaded from JSON files is parsed and returned as TochkaSyncRecord[] without Zod or equivalent runtime schema validation.
- Risk: Malformed or drifted sync payloads can propagate into normalization logic and fail unpredictably.
- Why it matters (STYLEGUIDE): External inputs should be validated at boundaries.
- Recommendation: Add a strict/explicit schema for sync file records (or reuse adapter schema) and validate each record before returning.

2. Parsing/shape errors are converted into silent non-identified records
- Location: src/preview/tochka.ts:29, src/preview/tochka.ts:76
- Issue: normalizeTochkaRecord wraps all logic in a broad try/catch and converts any error into identified: false.
- Risk: Real data-contract issues and mapping bugs can be silently downgraded to skipped records, causing unnoticed data loss in apply flows.
- Why it matters (STYLEGUIDE): Fail fast in CLI flows and avoid swallowing errors silently.
- Recommendation: Distinguish unsupported business cases from structural/parsing failures. Throw on structural errors (or collect and surface aggregated hard errors) instead of silently skipping.

3. TOCHKA_PAGE_SIZE is not validated and may accept invalid values
- Location: src/adapters/tochka.ts:60
- Issue: TOCHKA_PAGE_SIZE is read via Number(process.env.TOCHKA_PAGE_SIZE) || 250 with no bounds/integer validation.
- Risk: Values like -1, 0, or very large numbers can degrade behavior (invalid request pagination, excessive upstream load, unstable loops).
- Recommendation: Validate as integer with explicit range (e.g., 1..500) using Zod/env schema and fail with actionable error message.

### 🟢 SUGGESTION

1. Consolidate status/type literals into named constants
- Location: src/preview/tochka.ts
- Context: supportedStatuses and supportedTypes are defined inline.
- Benefit: Better readability/testability and easier extension of rules.

2. Align async signature with implementation
- Location: src/preview/loader.ts:9
- Context: loadSyncFiles is async but uses sync fs APIs only.
- Benefit: Either use async fs APIs for true non-blocking behavior or remove async for semantic clarity.

## Positive Notes

- Strong use of unknown and Zod in key boundaries (adapter and env validation).
- Source-specific integration logic remains isolated in adapter/preview modules.
- CLI error messages are generally actionable and terminate with explicit non-zero exit paths.

## Overall Assessment

- Review status: Changes are close to production-ready.
- Blocking concerns: none (accepted risks documented below).

## Re-validation (2026-05-13)

Validation run:
- `npm run check`: passed (typecheck + biome + tests).

Status by discussion points:
- Point 3 (runtime validation in sync file loader): accepted risk for now (deferred by decision).
- Point 4 (broad catch in normalization): accepted risk for now (deferred by decision).
	- Rationale: non-identified records keep `identificationError`, and these records are reviewed before save/apply flow.
	- Current state: `normalizeTochkaRecord` catches generic errors and returns `identified: false` with `identificationError`.
	- Location: `src/preview/tochka.ts`.
- Point 5 (`TOCHKA_PAGE_SIZE` env bounds validation): accepted risk for now (deferred by decision).
- Point 6 (constants for supported status/type): fixed.
- Point 7 (sync loader async/signature alignment): fixed.
