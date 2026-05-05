## MODIFIED Requirements

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
- **THEN** adapter defaults such as page size and static headers are defined in named constants
- **AND** the request/RPC identifier uses runtime UUID generation

## ADDED Requirements

### Requirement: Tochka timeline payload is validated with explicit transaction typing
The system SHALL validate Tochka timeline responses with an explicit transaction schema for core fields rather than untyped unknown arrays.

#### Scenario: Parse valid timeline transaction payload
- **WHEN** the Tochka API returns timeline data matching the expected transaction structure
- **THEN** the adapter validates and maps records using explicit typed fields

#### Scenario: Reject structurally invalid timeline payload
- **WHEN** the Tochka API returns timeline data that violates required transaction field constraints
- **THEN** the adapter fails with a classified parsing error that indicates payload validation failure

### Requirement: Tochka adapter errors are classified for operator diagnostics
The system SHALL classify Tochka adapter failures into meaningful categories (validation, authentication, upstream request/response) for clearer diagnostics.

#### Scenario: Upstream HTTP failure classification
- **WHEN** the Tochka API responds with a non-success HTTP status during sync
- **THEN** the adapter returns a classified upstream failure error with status context
- **AND** the user-facing message remains actionable and does not leak secrets
