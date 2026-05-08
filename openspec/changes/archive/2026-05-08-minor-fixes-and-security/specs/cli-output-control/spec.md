## ADDED Requirements

### Requirement: CLI Output Suppression
The `sync` command SHALL provide a mechanism to suppress informational messages (e.g., status messages, success summaries) to allow for clean stdout containing only the operation results.

#### Scenario: Sync with quiet flag
- **WHEN** the `sync` command is executed with the `--quiet` flag
- **THEN** only the final data output (JSON) is written to stdout or the specified file
- **AND** informational messages like "Syncing from..." or "✓ Sync complete" are NOT displayed

### Requirement: Secure Customer ID Configuration
The system SHALL retrieve sensitive source configuration (specifically Tochka `customerId`) from environment variables instead of versioned configuration files.

#### Scenario: Read customerId from environment
- **WHEN** the application starts
- **THEN** it validates that `TOCHKA_CUSTOMER_ID` is present in the environment
- **AND** it uses this value for Tochka synchronization
