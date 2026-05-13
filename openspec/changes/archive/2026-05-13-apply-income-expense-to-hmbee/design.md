## Context

The repository already supports staged synchronization from Tochka and a preview-only `apply <source> --preview` flow. That preview path identifies supported income and expense records from synchronized files and emits a partial `hmbee` branch, but it does not yet produce the full Honey Money write payload or persist anything to Honey Money.

The apply stage adds several cross-cutting concerns at once: a final Honey Money draft shape, amount normalization rules, Honey Money API credentials, account identifier mapping, targeted operator selection, and created-id capture from the API response. These concerns span CLI orchestration, preview shaping, configuration loading, and a new outbound API client, so they benefit from an explicit design before later persistence work is layered on top.

## Goals / Non-Goals

**Goals:**
- Reuse synchronized files as the source of truth for apply operations rather than re-fetching from Tochka.
- Expand the preview `hmbee` branch into the canonical Honey Money transaction draft used for writes.
- Save only identified Tochka income and expense records by default.
- Support a targeted apply mode via `--only-id` for operator-driven testing of specific source transaction ids.
- Resolve Tochka account numbers to Honey Money account ids via local configuration.
- Validate Honey Money write credentials before any outbound request.
- Capture created Honey Money transaction ids in CLI output so later persistence work can build on a stable contract.

**Non-Goals:**
- SQLite persistence, rerun protection, or deduplication.
- Transfer handling, transfer pairing, or transfer-specific Honey Money payloads.
- Retry queues, batch orchestration, or partial-run recovery beyond surfaced errors.
- Moving all category mapping logic out of code in this change.
- Reworking the sync pipeline or adding a second source implementation.

## Decisions

### Decision: Reuse the preview pipeline as the apply input contract
The apply path will continue to read synchronized source files from `sync/<source>` and will build on the same normalized preview interpretation rules instead of introducing a separate parser for writes.

Rationale:
- Keeps preview and apply behavior consistent for identification, amount selection, and category mapping.
- Preserves the staged operator workflow of sync first, inspect second, save third.
- Avoids duplicating source-shape logic across preview and apply paths.

Alternative considered:
- Implement a second write-only parser for Honey Money save operations. Rejected because it would drift from preview behavior and make debugging harder.

### Decision: Make the `hmbee` branch the canonical Honey Money draft contract
The `hmbee` branch will be expanded from a single mapped category field into the full Honey Money transaction draft, including subtype, account id, date, currency, description, repeat defaults, and final amount.

Rationale:
- Lets `apply --preview` show the exact payload shape that `apply` will send.
- Creates one stable target-specific contract that later persistence work can reference.
- Keeps Honey Money-specific concerns out of the normalized record while still making them inspectable.

Alternative considered:
- Build the full Honey Money payload only inside the write path. Rejected because preview would no longer reflect the real outbound draft.

### Decision: Normalize Honey Money amounts through a dedicated rounding adapter
The final Honey Money amount will be derived by taking the absolute source amount, rounding it to the nearest integer, and then applying subtype-based sign rules: expenses are negative and incomes are positive.

Rationale:
- Matches observed Honey Money payload shape and stored transaction examples.
- Makes the rounding rule explicit and testable instead of burying it inside CLI orchestration.
- Prevents sign handling from being duplicated across preview and apply call sites.

Alternative considered:
- Pass through Tochka decimal amounts directly. Rejected because existing Honey Money examples show integer-valued `real_amount` payloads and responses.

### Decision: Apply saves only identified records and filters targeted ids afterward
Default apply behavior will send only records that have already been identified as supported income or expense records. The optional `--only-id` filter will run after identification so operators can limit writes to a chosen subset of valid records without changing the underlying source parsing behavior.

Rationale:
- Keeps the default behavior safe and aligned with the existing preview pipeline.
- Makes targeted testing deterministic without exposing unsupported records to the write path.
- Avoids overloading source parsing with operator-only selection logic.

Alternative considered:
- Let `--only-id` override identification and force unsupported records through the write path. Rejected because it would weaken the normalized contract and increase failure modes.

### Decision: Split Honey Money secrets from Tochka account mapping data
Honey Money credentials (`HM_USER_EMAIL`, `HM_USER_TOKEN`, and related request settings) will remain environment-based secrets, while Tochka account number to Honey Money account id mappings will live in versioned local configuration.

Rationale:
- Keeps secrets out of versioned config while preserving reviewable, non-secret account mapping data.
- Makes account mismatches visible and easy to update when bank/Honey Money accounts change.
- Preserves the existing local-config pattern used elsewhere in the repository.

Alternative considered:
- Put Honey Money account ids into environment variables alongside secrets. Rejected because the mapping is not secret material and becomes hard to review and maintain in env-only form.

### Decision: Capture created Honey Money ids in stdout and defer persistence
The apply command will surface source transaction id to Honey Money transaction id pairs in its JSON output, but it will not store them locally in this change.

Rationale:
- Gives the operator immediate visibility into what was created.
- Establishes the output contract needed by the later SQLite registry change.
- Keeps this change focused on write behavior rather than rerun safety.

Alternative considered:
- Add local persistence now. Rejected because persistence is explicitly deferred to the next planned change.

## Risks / Trade-offs

- [Risk] Re-running `apply` without persistence can create duplicate Honey Money transactions. → Mitigation: keep persistence out of scope but support preview-first review and targeted `--only-id` runs for controlled testing.
- [Risk] Incorrect Tochka-to-Honey-Money account mapping can save transactions to the wrong account. → Mitigation: require explicit config mapping and fail before any write when a mapping is missing.
- [Risk] Honey Money rounding expectations may differ from some edge-case source amounts. → Mitigation: isolate the rounding adapter and cover it with focused tests so future adjustment is explicit.
- [Risk] A mid-run Honey Money failure can leave the operator with a partially applied batch. → Mitigation: emit created ids for successful writes before the failure and keep the write loop simple until persistence/recovery work is introduced.
- [Risk] New modules increase project surface area. → Mitigation: keep the client and apply-selection helper small, typed, and aligned with existing module boundaries and Biome formatting rules.

## Migration Plan

No data migration is required. The rollout is a CLI behavior change plus additional local configuration and environment inputs.

Implementation rollout:
1. Expand the preview `hmbee` branch into a save-ready Honey Money draft.
2. Add local account mapping resolution and Honey Money environment validation.
3. Add the Honey Money client and non-preview `apply` write path.
4. Add targeted apply filtering with `--only-id`.
5. Validate with focused tests, `npm run typecheck`, and `npm run check`.

Rollback strategy:
- Remove the Honey Money client and restore `apply` to preview-only mode.
- Remove account mapping resolution and Honey Money env requirements.
- Keep synchronized source files unchanged so the operator can fall back to preview inspection.

## Open Questions

- Should a later change introduce dry-run reporting for which ids would be skipped by `--only-id` before writes begin?
- Should Honey Money write requests later gain retry/backoff behavior, or remain strictly one-request-per-record under operator control?
- Should future persistence store full apply responses or only source-id to Honey-Money-id pairs?

## Engineering Constraints

- Preserve strict typing across normalized records, Honey Money drafts, apply selection helpers, and API response parsing.
- Validate environment and configuration boundaries before any outbound Honey Money request, and keep error messages actionable without exposing secret values.
- Keep command orchestration in the CLI layer, source-to-draft shaping in preview-specific modules, and outbound HTTP logic in a dedicated Honey Money client module.
- Keep new modules small and explicit; avoid introducing generic abstractions until a second write path or source requires them.
- Maintain compatibility with existing Biome formatting/lint rules and TypeScript strict mode; any added helper or client module must pass `npm run check`.