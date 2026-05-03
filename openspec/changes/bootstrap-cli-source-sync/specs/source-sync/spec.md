## ADDED Requirements

### Requirement: CLI can list supported data sources
The system SHALL provide a CLI command that lists the supported data sources available to the operator.

#### Scenario: List supported data sources
- **WHEN** the operator runs the list command
- **THEN** the system prints the supported data source names

### Requirement: CLI can run source synchronization for a configured data source
The system SHALL provide a CLI command that runs source synchronization for a named data source using local project configuration and environment-based secrets.

#### Scenario: Run sync for a supported source
- **WHEN** the operator runs the sync command for a configured supported source
- **THEN** the system executes the matching source adapter
- **AND** the system fetches source records for the requested period

#### Scenario: Reject unknown source name
- **WHEN** the operator runs the sync command with a source name that is not configured or not supported
- **THEN** the system fails with a clear error identifying the unknown source

### Requirement: Source synchronization requires validated local secrets
The system SHALL validate the required environment-based authentication inputs before attempting a source request.

#### Scenario: Missing required environment variable
- **WHEN** the operator runs sync for a source whose required environment variable is missing
- **THEN** the system fails before making the request
- **AND** the error identifies which required variable is missing

### Requirement: Tochka source adapter can fetch timeline data using manual session credentials
The system SHALL support a Tochka source adapter that uses the current manual session request flow to fetch timeline data.

#### Scenario: Fetch Tochka timeline data
- **WHEN** the operator runs sync for the Tochka source with valid local session credentials and a requested period
- **THEN** the system sends the Tochka timeline request
- **AND** the system returns the fetched timeline payload as the sync result

### Requirement: Sync results are observable for operator inspection
The system SHALL expose fetched sync results in an inspectable form so the operator can validate the source integration before later import steps are added.

#### Scenario: Inspect sync output
- **WHEN** a sync operation completes successfully
- **THEN** the system shows a structured result summary, saves raw payload output, or both
- **AND** the operator can inspect the fetched source data without modifying Honey Money

### Requirement: Sync command supports output format and destination control
The system SHALL allow the operator to choose whether sync results are emitted as adapter-shaped data or raw source data, and whether they are printed to STDOUT or written to a file.

#### Scenario: Use adapted output by default
- **WHEN** the operator runs sync without an explicit output format flag
- **THEN** the system emits adapter-shaped sync output by default

#### Scenario: Write selected sync output to a file
- **WHEN** the operator runs sync with an output path option
- **THEN** the system writes the selected sync output to the requested file path