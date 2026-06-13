## ADDED Requirements

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
The system SHALL persist the fetched Honey Money transactions to a local cache file, keeping only records dated on or after the requested window start minus a fixed lookback.

#### Scenario: Trim and write the cache
- **WHEN** the operator updates the Honey Money cache for a sync window starting at `--from`
- **THEN** the system keeps only Honey Money records with `date >= (--from − 10 days)`
- **AND** the system writes the kept records to `sync/hmbee/all_json_cache.json`
- **AND** the file is overwritten on each cache update

#### Scenario: Cache directory is created when missing
- **WHEN** the cache is written and the `sync/hmbee/` directory does not exist
- **THEN** the system creates the directory before writing the cache file

### Requirement: Cache update is triggered from the sync command flag
The system SHALL update the Honey Money cache when the operator runs the sync command with the cache-update flag, in addition to the normal source synchronization.

#### Scenario: Update cache alongside source sync
- **WHEN** the operator runs `sync <source> --from <date> --to <date> --update-hmbee-cache`
- **THEN** the system performs the normal source synchronization
- **AND** the system also fetches Honey Money transactions and writes the trimmed cache

#### Scenario: Cache is not touched without the flag
- **WHEN** the operator runs `sync <source>` without the cache-update flag
- **THEN** the system does not fetch Honey Money transactions
- **AND** the existing Honey Money cache file is left unchanged
