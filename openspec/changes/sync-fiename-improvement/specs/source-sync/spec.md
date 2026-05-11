## MODIFIED Requirements

### Requirement: Sync command supports output format and destination control
The system SHALL allow the operator to choose whether sync results are emitted as adapter-shaped data or raw source data. The system SHALL automatically save sync results to a standardized file path to ensure predictable data discovery.

#### Scenario: Use adapted output by default
- **WHEN** the operator runs sync without an explicit output format flag
- **THEN** the system emits adapter-shaped sync output by default

#### Scenario: Write selected sync output to standardized file path
- **WHEN** the operator runs sync for a specific source and period (from/to)
- **THEN** the system SHALL write the sync output to `sync/[source]/[from]_[to].json`
- **AND** the system SHALL create the destination directory if it does not exist
- **AND** the system SHALL NOT support a manual output path flag (`--out`)

## REMOVED Requirements

### Requirement: Write selected sync output to a file
**Reason**: Replaced by mandatory standardized output path to ensure predictable discovery for the `apply` command.
**Migration**: Remove usage of `--out` flag. Files are now saved to `sync/[source]/[from]_[to].json` automatically.
