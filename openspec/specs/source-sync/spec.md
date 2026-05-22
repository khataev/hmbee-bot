# source-sync

## Purpose
Synchronization of transaction data from external sources (banks, CSV files, etc.) under operator control.
## Requirements
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
The system SHALL validate required environment-based authentication inputs before attempting a source request and SHALL provide actionable setup guidance without exposing secret values.

#### Scenario: Missing required environment variable
- **WHEN** the operator runs sync for a source whose required environment variable is missing
- **THEN** the system fails before making the request
- **AND** the error identifies which variable is missing
- **AND** the error includes a clear remediation hint for local setup

#### Scenario: Sensitive values are not exposed in validation errors
- **WHEN** sync validation fails for source authentication inputs
- **THEN** the system logs and user-facing errors MUST NOT include full cookie/session/secret values

### Requirement: Tochka source adapter can fetch timeline data using manual session credentials
The system SHALL support a Tochka source adapter that uses manual session credentials to fetch timeline data with robust CSRF extraction and stable request construction.

#### Scenario: Fetch Tochka timeline data with robust CSRF parsing
- **WHEN** the operator runs sync for the Tochka source with valid local session credentials and a requested period
- **THEN** the system derives the CSRF token from cookie key/value parsing rather than fragile full-string matching
- **AND** the system sends the Tochka timeline request and returns the fetched timeline payload as the sync result

#### Scenario: Request metadata is deterministic and maintainable
- **WHEN** the Tochka adapter builds request payload and headers
- **THEN** adapter defaults such as static headers are defined in named constants
- **AND** the request/RPC identifier uses runtime UUID generation

### Requirement: Paginated Timeline Fetch
The Tochka adapter SHALL iteratively fetch timeline data if the number of returned records matches the requested page size.

#### Scenario: Single page response
- **WHEN** the adapter requests a page of data and receives fewer records than the `page_count`
- **THEN** the adapter SHALL return those records and terminate the sync process

#### Scenario: Multi-page response
- **WHEN** the adapter requests a page of data and receives exactly the `page_count` number of records
- **THEN** the adapter SHALL extract the `event_date` from the last record's `meta_data.time_data` and use it as `last_date` for the next request
- **THEN** it SHALL continue fetching until a page with fewer records than `page_count` is received

### Requirement: Configurable Page Size
The adapter SHALL use a configurable page size for timeline requests.

#### Scenario: Production page size
- **WHEN** running in production mode
- **THEN** the `page_count` parameter SHALL be set to 250

#### Scenario: Testing page size
- **WHEN** running in test mode (or configured via environment)
- **THEN** the `page_count` parameter SHALL be set to 10

### Requirement: Sync results are observable for operator inspection
The system SHALL expose fetched sync results in an inspectable form so the operator can validate the source integration before later import steps are added.

#### Scenario: Inspect sync output
- **WHEN** a sync operation completes successfully
- **THEN** the system shows a structured result summary, saves raw payload output, or both
- **AND** the operator can inspect the fetched source data without modifying Honey Money

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

### Requirement: Tochka timeline payload is validated with explicit transaction typing
The system SHALL validate Tochka timeline responses with an explicit transaction schema for core fields rather than untyped unknown arrays.

#### Scenario: Parse valid timeline transaction payload
- **WHEN** the Tochka API returns timeline data matching the expected transaction structure
- **THEN** the adapter validates and maps records using explicit typed fields

#### Scenario: Reject structurally invalid timeline payload
- **WHEN** the Tochka API returns timeline data that violates required transaction field constraints
- **THEN** the adapter fails with a classified parsing error that indicates payload validation failure
- **AND** the adapter SHALL throw a `TochkaError` with the message "Sync failed: Tochka timeline response does not match the expected schema"

### Requirement: Tochka adapter errors are classified for operator diagnostics
The system SHALL classify Tochka adapter failures into meaningful categories (validation, authentication, upstream request/response) for clearer diagnostics.

#### Scenario: Upstream HTTP failure classification
- **WHEN** the Tochka API responds with a non-success HTTP status during sync
- **THEN** the adapter returns a classified upstream failure error with status context
- **AND** the user-facing message remains actionable and does not leak secrets

