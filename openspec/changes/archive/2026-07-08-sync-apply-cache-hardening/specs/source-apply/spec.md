## ADDED Requirements

### Requirement: Apply refreshes the Honey Money cache before the skip pass
The system SHALL refresh the local Honey Money cache before building the manual-entry skip index on every `apply <source>` run, including `--preview` and `--preview-planned`, unless the operator passes `--skip-hmbee-cache-update`. The refresh SHALL fetch current Honey Money transactions, trim them using the sync file's start date as the boundary, and overwrite the cache file, so the skip pass always operates on current Honey Money state and repeated apply runs do not create duplicate transactions. If the refresh fails, the system SHALL abort the run with a classified error and MUST NOT send or preview any records, and the error MUST NOT expose full cookie/session/token values.

#### Scenario: Refresh runs before the skip pass on a non-preview apply
- **WHEN** the operator runs non-preview `apply <source>` without `--skip-hmbee-cache-update`
- **THEN** the system refreshes the Honey Money cache before computing the skip index
- **AND** records already present in the refreshed cache are marked as manual entries and are not sent again

#### Scenario: Repeated apply does not duplicate transactions
- **WHEN** the operator runs `apply <source>`, then runs the same `apply <source>` again without manually updating the cache
- **THEN** the second run refreshes the cache before the skip pass and skips the transactions created by the first run
- **AND** no duplicate transaction is sent to Honey Money

#### Scenario: Refresh also runs in preview modes
- **WHEN** the operator runs `apply <source> --preview` or `apply <source> --preview-planned` without `--skip-hmbee-cache-update`
- **THEN** the system refreshes the Honey Money cache before producing the preview output

#### Scenario: Opt-out skips the refresh
- **WHEN** the operator runs `apply <source> --skip-hmbee-cache-update`
- **THEN** the system does not fetch Honey Money transactions
- **AND** the skip pass uses the existing cache file unchanged

#### Scenario: Refresh failure aborts the run
- **WHEN** the Honey Money cache refresh fails during `apply <source>` without `--skip-hmbee-cache-update`
- **THEN** the system exits with a non-zero code without sending or previewing any records
- **AND** the error message does not expose full cookie/session/token values

#### Scenario: Trimming boundary comes from the sync file
- **WHEN** the cache is refreshed during `apply <source>` for a sync file named `<from>_<to>.json`
- **THEN** the trimming boundary uses `<from>` as the sync window start
