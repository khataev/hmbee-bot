# hmbee-transaction-cache

## Purpose
Local cache of Honey Money transactions used to support manual-entry detection during the apply step.

## Requirements

### Requirement: Honey Money client can fetch all transactions
The system SHALL provide a Honey Money client method that fetches the full transaction list from the Honey Money `all_json` endpoint using the same environment-based authentication as the write path.

#### Scenario: Fetch all transactions
- **WHEN** the cache update requests all Honey Money transactions
- **THEN** the client issues a GET request to the Honey Money `all_json.json` endpoint
- **AND** the request uses the configured `user-email`, `user-token`, `hm-source`, and cookie authentication from environment secrets
- **AND** the client returns the transactions as a list parsed from the JSON array response

#### Scenario: Fetch fails with a clear error
- **WHEN** the Honey Money `all_json` request returns a non-success HTTP status
- **THEN** the client fails with an error identifying the failed Honey Money request
- **AND** the error MUST NOT include full cookie/session/token values

### Requirement: Honey Money cache is written with date trimming
The system SHALL persist the fetched Honey Money transactions to a local cache file, keeping only records dated on or after the sync window start minus a fixed lookback. The sync window start is the `<from>` date derived from the active sync file name.

#### Scenario: Trim and write the cache
- **WHEN** the system updates the Honey Money cache for a sync window whose start date is `from`
- **THEN** the system keeps only Honey Money records with `date >= (from − 10 days)`
- **AND** the system writes the kept records to `sync/hmbee/all_json_cache.json`
- **AND** the file is overwritten on each cache update

#### Scenario: Cache directory is created when missing
- **WHEN** the cache is written and the `sync/hmbee/` directory does not exist
- **THEN** the system creates the directory before writing the cache file

### Requirement: Cache update is triggered by the apply command
The system SHALL update the Honey Money cache from the `apply <source>` command before the manual-entry skip pass, on every run including preview modes, unless the operator passes `--skip-hmbee-cache-update`. The cache update SHALL reuse the fetch-and-trim behavior of this capability, using the sync file's start date as the trimming boundary.

#### Scenario: Apply updates the cache by default
- **WHEN** the operator runs `apply <source>` without `--skip-hmbee-cache-update`
- **THEN** the system fetches Honey Money transactions and writes the trimmed cache before the skip pass

#### Scenario: Cache is not touched under the opt-out flag
- **WHEN** the operator runs `apply <source> --skip-hmbee-cache-update`
- **THEN** the system does not fetch Honey Money transactions
- **AND** the existing Honey Money cache file is left unchanged

### Requirement: Cached entries retain plan recurrence fields
The system SHALL retain the plan recurrence fields when caching Honey Money transactions, so the confirmation payload can echo them back without an extra fetch.

#### Scenario: Recurrence fields survive caching
- **WHEN** Honey Money transactions are fetched and written to the cache
- **THEN** each cached entry retains `planned_repeat_days`, `planned_repeat_end`, and `planned_repeat_end_date` when present

#### Scenario: Confirmation echoes cached recurrence
- **WHEN** a confirmation payload is built from a cached plan
- **THEN** the plan recurrence fields come from the cached entry
- **AND** no additional Honey Money request is needed to obtain them
