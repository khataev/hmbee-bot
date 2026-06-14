## ADDED Requirements

### Requirement: Sync command exposes an optional Honey Money cache update flag
The system SHALL provide an optional `--update-hmbee-cache` flag on the sync command that updates the local Honey Money cache in addition to the normal source synchronization, reusing the sync window start as the cache trimming boundary.

#### Scenario: Sync with cache update flag
- **WHEN** the operator runs the sync command with `--update-hmbee-cache`
- **THEN** the system runs the normal source synchronization for the requested period
- **AND** the system updates the Honey Money cache using the sync `--from` date as the trimming boundary

#### Scenario: Sync without cache update flag is unchanged
- **WHEN** the operator runs the sync command without `--update-hmbee-cache`
- **THEN** the system behaves exactly as before, performing only source synchronization
