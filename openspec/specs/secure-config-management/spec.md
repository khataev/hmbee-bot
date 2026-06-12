# secure-config-management

## Purpose
Management of sensitive configuration and credentials for source adapters and target system operations.

## Requirements

### Requirement: Secure Configuration Loading
The system SHALL prioritize environment-based configuration for sensitive source identifiers like `customerId`.

#### Scenario: Environment variable validation
- **WHEN** `validateTochkaEnv()` is called
- **THEN** it must ensure `TOCHKA_CUSTOMER_ID` is present and non-empty.

### Requirement: Honey Money write operations require validated local secrets
The system SHALL validate required Honey Money authentication and request settings from the local environment before attempting any write operation.

#### Scenario: Missing Honey Money apply variable
- **WHEN** the operator runs `apply <source>` without one or more required Honey Money environment variables
- **THEN** the system fails before making any Honey Money request
- **AND** the error identifies which Honey Money environment variables are missing or invalid

### Requirement: Honey Money account mappings remain in non-secret local configuration
The system SHALL load bank-account-to-Honey-Money account mappings from versioned local configuration rather than from environment secrets, for every bank configured under `sources`.

#### Scenario: Resolve Honey Money account id from local mapping config
- **WHEN** the application loads local configuration for a configured bank source
- **THEN** it reads the configured Honey Money account catalog and account mappings for that bank from `config/sources.json`
- **AND** it resolves the final Honey Money account id for each configured account without requiring that mapping in environment variables

#### Scenario: Account mappings of all configured banks are loaded
- **WHEN** the application loads local configuration and `config/sources.json` defines more than one bank under `sources` (for example `tochka`, `sber`, `tinkoff`)
- **THEN** the resolved configuration includes the account mappings of every configured bank
- **AND** no configured bank block is silently dropped during schema parsing

#### Scenario: Duplicate account number across banks is rejected
- **WHEN** the application loads local configuration
- **AND** the same account number is mapped under two different banks to different Honey Money account ids
- **THEN** configuration loading fails with an error that identifies the conflicting account number
