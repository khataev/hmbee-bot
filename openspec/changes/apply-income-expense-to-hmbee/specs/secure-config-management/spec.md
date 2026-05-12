## ADDED Requirements

### Requirement: Honey Money write operations require validated local secrets
The system SHALL validate required Honey Money authentication and request settings from the local environment before attempting any write operation.

#### Scenario: Missing Honey Money apply variable
- **WHEN** the operator runs `apply <source>` without one or more required Honey Money environment variables
- **THEN** the system fails before making any Honey Money request
- **AND** the error identifies which Honey Money environment variables are missing or invalid

### Requirement: Honey Money account mappings remain in non-secret local configuration
The system SHALL load Tochka-to-Honey-Money account mappings from versioned local configuration rather than from environment secrets.

#### Scenario: Resolve Honey Money account id from local mapping config
- **WHEN** the application loads local configuration for the Tochka source
- **THEN** it reads the configured Honey Money account catalog and Tochka account mappings from `config/sources.json`
- **AND** it resolves the final Honey Money account id for each configured Tochka account without requiring that mapping in environment variables