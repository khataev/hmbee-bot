## Context

The repository currently contains example requests and responses for Tochka and Honey Money, but no implemented CLI flow. The first change needs to validate the project shape against a real source integration while keeping scope narrow: manual execution, local environment files, and source synchronization only.

This change establishes the initial CLI entrypoint, environment handling, and data source adapter contract that future sources can follow. It intentionally avoids Honey Money write operations, sync-state persistence, and automatic authentication so that the first iteration focuses on one risk at a time: reliably fetching source records from Tochka under operator control.

## Goals / Non-Goals

**Goals:**
- Provide local CLI commands for listing supported data sources and fetching source transaction data for a requested period.
- Define a simple data source adapter contract that supports additional sources without introducing a full plugin framework.
- Support manual environment-based authentication for Tochka.
- Make the sync output observable, either in terminal form or as saved data, so the fetched payload can be inspected before later changes add preview/apply flows.
- Keep configuration explicit and source-specific.

**Non-Goals:**
- Sending transactions to Honey Money.
- Deduplication, sync history, or SQLite-backed state.
- Automatic browser or headless authentication.
- A generic transformation engine shared by all future integrations.
- Final transaction-kind inference rules beyond what is needed to fetch source records.

## Decisions

### Decision: Use a CLI-first structure with one command per user-visible action

The initial command surface will be built around user-facing CLI actions rather than internal layers. For this change, the required actions are `list` and `sync`.

Rationale:
- Matches the manual workflow agreed for MVP.
- Keeps the first change small and observable while still exposing the supported data sources.
- Leaves room for later `preview` and `apply` commands without forcing them into the first increment.

Alternative considered:
- Build all command scaffolding for `sync`, `preview`, and `apply` immediately. Rejected because only `sync` is in scope for this change and premature command wiring would add noise.

### Decision: Treat data source adapters as the primary extension point

Each data source adapter will own source-specific request construction, environment requirements, and conversion into a source-sync result shape suitable for inspection.

Rationale:
- Aligns with the current project direction: adapters are the main abstraction, not separate transformers.
- Supports future non-JSON sources such as CSV without changing the CLI contract.
- Keeps source-specific logic in one place.

Alternative considered:
- Split adapters from a separate transformation layer immediately. Rejected because the project does not yet need a shared intermediate model or multiple downstream targets.

### Decision: Use explicit source-specific configuration plus environment files

Local secrets stay in ignored environment files, while non-secret data source configuration lives in project configuration.

Rationale:
- Manual auth is acceptable for MVP.
- Secrets and behavioral config have different change patterns and should not be mixed.
- Makes the first adapter reproducible without embedding live values in code.

Alternative considered:
- Store everything in one configuration file. Rejected because source secrets need stricter handling and frequent local refresh.

### Decision: Default sync output to adapter-shaped data and make raw output explicit

The `sync` flow will expose fetched results in a human-observable way. The recommended command shape is:

`hmbee-bot sync <source> --from=YYYY-MM-DD --to=YYYY-MM-DD [--format=adapted|raw] [--out=<path>]`

The default output should be adapter-shaped data suitable for later Honey Money work, while raw source payloads remain available through an explicit `--format=raw` option.

Rationale:
- This stage is primarily about validating source integration.
- Inspection is needed before later changes introduce Honey Money writes.
- Adapter-shaped output is the most useful default because it reflects the data source contract the CLI is validating.
- Raw payload visibility still helps future adapter and mapping design.

Alternative considered:
- Default to raw-only output. Rejected because raw payloads are valuable for debugging but are a weaker default for the intended sync workflow.

### Decision: Add a `list` command for supported data sources

The CLI will expose a `list` command that prints the currently supported data sources and enough identifying information for an operator to choose a source name for `sync`.

Rationale:
- Makes the concept of a data source visible in the user-facing interface.
- Reduces guesswork around valid source names.
- Gives future adapters a natural discovery surface.

Alternative considered:
- Document source names only in README or config examples. Rejected because discoverability belongs in the CLI itself.

## Risks / Trade-offs

- Manual session data may expire frequently and make the first adapter feel unstable. → Keep auth out of scope and design env validation so failures are explicit.
- Tochka request headers may contain browser-specific noise that is not actually required. → Start from the captured request shape and reduce only after the sync path is working.
- Early config shape may need revision once preview/apply and mapping rules arrive. → Keep config minimal in this change and avoid claiming a universal schema.
- The data source adapter contract may be too narrow for later CSV or multi-endpoint sources. → Define the contract around sync behavior and inspect the second source before generalizing further.

## Open Questions

- Whether `--out` should always write the full selected payload or support summary-only output in a later change.
- Whether adapted sync output should preserve a small raw metadata envelope for debugging without requiring `--format=raw`.