## MODIFIED Requirements

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
