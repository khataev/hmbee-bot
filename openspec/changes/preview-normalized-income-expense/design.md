## Context

The repository currently supports source synchronization through `sync`, but it does not yet provide an operator-facing way to inspect what a synchronized file would mean for Honey Money import. The next step needs to make Tochka income and expense records observable before write operations and local persistence are added.

This preview change introduces two related representations from the same source record stream:
- a normalized internal representation used for operator inspection and future pipeline stability
- an `hmbee` branch used to accumulate Honey Money-oriented fields without mixing them into the normalized model

The change is intentionally limited to income and expense flows. Transfer handling is deferred because Tochka transfer-like records use different source shapes and pairing rules that would overload this first preview slice.

## Goals / Non-Goals

**Goals:**
- Add an `apply <source> --preview` flow that reads synchronized files from `sync/<source>`.
- Support Tochka preview for income and expense records only.
- Introduce one normalized internal record shape that can evolve across later changes.
- Keep Honey Money-oriented output in a separate `hmbee` branch so normalization and target mapping remain separable.
- Introduce source-specific category mapping for Tochka preview output.
- Add `vitest` so normalization and mapping behavior can be validated with focused automated tests.

**Non-Goals:**
- Sending transactions to Honey Money.
- Saving imported transaction state to SQLite.
- Handling transfers or transfer pairing.
- Finalizing all future normalized fields needed for transfer workflows.
- Building a generic multi-source plugin system beyond the current adapter structure.

## Decisions

### Decision: Introduce a single normalized preview record plus a separate `hmbee` branch
The preview output will use one canonical record shape with two top-level sections:
- `normalized`: the internal source-derived representation
- `hmbee`: Honey Money-oriented mapped data produced from the normalized record

Rationale:
- Avoids proliferating one-off intermediate formats.
- Preserves a stable internal model for preview, filtering, and future persistence work.
- Keeps Honey Money mapping separate so target-specific fields do not pollute the normalized contract.

Alternative considered:
- Use a temporary `debug` object for the internal representation. Rejected because the internal model is expected to become a long-lived contract rather than a transient troubleshooting payload.

### Decision: Scope preview to synchronized files stored under `sync/<source>`
The `apply --preview` flow will read its input from the synchronization output directory contract `sync/<source>` rather than calling the upstream source directly.

Rationale:
- Keeps preview deterministic and reviewable.
- Preserves the staged workflow of fetch first, inspect second.
- Avoids coupling this change to source network behavior.

Alternative considered:
- Reuse live source fetch logic directly inside preview. Rejected because it would mix synchronization and interpretation concerns and make testing harder.

### Decision: Handle only Tochka income and expense records with explicit status filtering
The first preview implementation will classify Tochka records for income and expense only. For the initial supported slice, records with statuses `Withdraw` and `InProgress` are eligible for identification; unsupported statuses remain in preview with `identified = false`.

Rationale:
- Matches the current task focus.
- Preserves visibility into skipped records without silently dropping them.
- Avoids transfer-specific complexity in the first preview model.

Alternative considered:
- Drop unsupported records entirely from preview. Rejected because operator review benefits from seeing what was skipped and why.

### Decision: Keep category mapping source-specific and populate Honey Money fields incrementally
Category mapping for Tochka will be driven by source-specific configuration. The `hmbee` branch will start with mapped category data and expand in later changes toward the full Honey Money payload.

Rationale:
- Category mapping depends on source semantics and should remain close to the source adapter.
- Incremental growth of the `hmbee` branch keeps this change reviewable.
- Avoids premature commitment to a full Honey Money write contract before preview is validated.

Alternative considered:
- Build the full Honey Money payload immediately in this change. Rejected because save logic, rounding, and persistence are intentionally deferred.

### Decision: Add `vitest` now as the project test runner baseline
This change will add `vitest` and a minimal test setup to cover parsing, status filtering, normalization, and category mapping for the preview flow.

Rationale:
- The preview and normalization rules are data-shape sensitive and need fast focused tests.
- Future `hmbee` and persistence changes will depend on the same record interpretation rules.
- A test baseline now reduces regression risk as parsing logic expands.

Alternative considered:
- Rely only on `npm run check` until save logic exists. Rejected because type and lint checks are insufficient for validating transaction classification and mapping behavior.

## Risks / Trade-offs

- [Risk] The first normalized shape may need extension once transfer workflows are added. → Mitigation: keep the model focused on income/expense now and reserve transfer-specific structure for a later change.
- [Risk] `InProgress` records may later need different treatment than `Withdraw` records. → Mitigation: keep status visible in normalized output and cover current rules with tests so later tightening is explicit.
- [Risk] Category mapping may be incomplete for real Tochka data variations. → Mitigation: preserve unmapped/unsupported visibility in preview output and cover mapping behavior with fixture-driven tests.
- [Risk] Adding a test runner changes project tooling surface. → Mitigation: keep the setup minimal, pin exact package versions, and integrate tests into the documented quality workflow.

## Migration Plan

No production migration is required. The change adds a new preview command path, new source-preview artifacts, and test tooling.

Implementation rollout:
1. Add the test runner and scripts.
2. Add preview command plumbing and synchronized file loading.
3. Add normalized preview record construction for Tochka income and expense records.
4. Add source-specific category mapping and the initial `hmbee` branch.
5. Validate with focused tests and `npm run check`.

Rollback strategy:
- Remove the preview command and associated modules.
- Remove `vitest` configuration and scripts if the preview approach is abandoned before later changes build on it.

## Open Questions

- Should preview default to JSON output only, or should a table view be introduced in the same command later?
- Should `accountName` be nullable in the normalized output when the synchronized file does not provide it directly?
- Should unsupported records always remain in preview output, or should a future flag allow hiding them?

## Engineering Constraints

- Preserve strict typing across normalized records, mapped `hmbee` output, and synchronized file input boundaries.
- Validate external input at boundaries: CLI options, synchronized file contents, and category mapping configuration.
- Keep command orchestration in the CLI layer and source-specific parsing/mapping inside adapters or preview-specific source modules.
- Use informative, non-secret-leaking errors for invalid files, unsupported shapes, and mapping failures.
- Keep new modules aligned with the existing Biome and TypeScript style baseline; any new testing modules or helpers must remain small, explicit, and easy to review.
- Validate the change with `npm run check` plus focused `vitest` test execution before marking tasks complete.
