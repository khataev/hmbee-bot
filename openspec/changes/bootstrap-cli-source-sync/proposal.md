## Why

The project needs a small but reliable first increment that can fetch source data from a real bank integration under manual operator control. Building the source synchronization path first reduces risk, validates the adapter shape against real Tochka data, and avoids coupling early exploration to Honey Money write logic or sync-state design.

## What Changes

- Add the initial TypeScript CLI structure for running project commands locally.
- Add a `list` command that shows the supported data sources.
- Add environment loading and validation for local secrets used by source adapters.
- Define the initial data source adapter contract for fetching source records.
- Implement the first data source adapter for Tochka using the current manual session-based request flow.
- Add a `sync` command with the shape `hmbee-bot sync <source> --from=YYYY-MM-DD --to=YYYY-MM-DD` for fetching data from a named source for a requested period.
- Add inspectable sync output controls so the operator can choose whether results are printed to STDOUT or written to a file, and whether the output is raw source data or adapter-shaped data.
- Add source-specific configuration support needed for the first data source and future data sources.

## Capabilities

### New Capabilities
- `source-sync`: Discover supported data sources and fetch source transaction data through CLI commands using configured data source adapters and manual environment-based authentication.

### Modified Capabilities

None.

## Impact

- Affects the TypeScript CLI entrypoint and command structure in `src/`.
- Introduces local environment configuration and validation for source secrets.
- Introduces the first adapter implementation for Tochka source synchronization.
- Establishes the initial shape of source configuration that later changes will extend for preview, apply, and mapping flows.