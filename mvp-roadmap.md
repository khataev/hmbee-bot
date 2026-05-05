# HMBee Bot MVP Roadmap

## Purpose

This document captures the high-level roadmap for the project before implementation begins.
It is not a detailed specification. Its role is to keep the MVP scope visible and to define the sequence of OpenSpec changes.

## Product Goal

Build a local TypeScript CLI utility that helps sync financial operations from external data sources into Honey Money.

At the MVP stage:

- the tool is run manually by a human
- secrets are provided through local environment files
- the first supported source is Tochka Bank
- the system focuses on reliable source synchronization first
- deduplication and persistent sync state are postponed to later stages

## MVP Principles

- Start with a CLI, not a background service
- Use source adapters as the main extension point
- Keep configuration source-specific and explicit
- Prefer previewable workflows over opaque automation
- Do not automate authentication in MVP
- Do not design for every bank upfront, but leave room for additional adapters

## Initial Command Model

- `sync` — fetch data from one or more configured sources
- `preview` — show the result of transformation without writing to Honey Money
- `apply` — send transformed operations to Honey Money

## MVP Scope

- TypeScript CLI project structure
- `.env`-based secret management
- Tochka source adapter based on the current browser session data
- Honey Money API client for reading session context and creating transactions
- Source-specific config for account mapping and category mapping
- Manual and observable workflow: fetch -> inspect -> apply

## Out Of Scope For MVP

- automatic login or browser-based auth flows
- deduplication and persistent sync history
- full support for all possible bank formats
- complex universal transaction-kind inference rules
- background workers, cron orchestration, or hosted deployment

## OpenSpec Change Roadmap

### 1. `bootstrap-cli-source-sync`

Goal:
Create the initial CLI skeleton and the source synchronization flow without Honey Money write logic.

Includes:

- project structure for CLI commands
- environment loading and validation
- initial source adapter contract
- first source adapter for Tochka
- `sync` command
- optional raw output persistence or terminal output for inspection

Does not include:

- transaction upload to Honey Money
- deduplication
- auth automation

### 2. `hmbee-preview-and-apply`

Goal:
Add Honey Money integration and complete the user-visible import flow.

Includes:

- Honey Money client
- reading session context, including accounts
- `preview` command
- `apply` command
- conversion of source records into Honey Money transaction payloads

Does not include:

- sync state storage
- deduplication

### 3. `mapping-rules`

Goal:
Formalize configuration-driven mapping rules used by source adapters.

Includes:

- account mapping rules
- category mapping rules
- description formatting rules
- source-specific configuration schema

Does not include:

- advanced generic rule engines unless clearly needed

### 4. `dedup-and-sync-state`

Goal:
Introduce local persistent state to make repeated imports safe.

Includes:

- SQLite-based local state
- imported transaction registry
- duplicate prevention rules
- repeatable re-run behavior

### 5. `additional-sources`

Goal:
Add support for more banks and other source formats.

Includes:

- second and subsequent source adapters
- support for non-JSON formats where needed, such as CSV
- validation that the adapter interface remains sufficient

### 6. `interactive-auth`

Goal:
Automate source authentication if manual session management becomes too costly.

Includes:

- browser-assisted or scripted authentication
- session refresh flow
- secure local handling of updated auth data

## Proposed Execution Order

1. `bootstrap-cli-source-sync`
2. `hmbee-preview-and-apply`
3. `mapping-rules`
4. `dedup-and-sync-state`
5. `additional-sources`
6. `interactive-auth`

## Notes

- The order may change if real integration findings force a redesign.
- `mapping-rules` may partially start inside the first two changes, but should become explicit once the first end-to-end flow is working.
- SQLite is intentionally deferred as a capability, even if the package appears earlier in the project.
- The first OpenSpec change should be `bootstrap-cli-source-sync`.