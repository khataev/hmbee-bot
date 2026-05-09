## ADDED Requirements

### Requirement: CLI can preview normalized source records from synchronized files
The system SHALL provide an `apply <source> --preview` flow that reads synchronized source files from `sync/<source>` and emits operator-inspectable preview output without writing to Honey Money.

#### Scenario: Preview synchronized records for a supported source
- **WHEN** the operator runs the preview flow for a supported source with synchronized input files available under `sync/<source>`
- **THEN** the system reads the synchronized source data from that directory
- **AND** the system emits preview output without sending any Honey Money write request

### Requirement: Preview output includes a normalized internal representation
The system SHALL emit a normalized representation for each previewed record so that source-derived meaning is inspectable independently from Honey Money-specific mapping.

#### Scenario: Emit normalized record for an identified expense or income
- **WHEN** a synchronized Tochka record is recognized as a supported income or expense record
- **THEN** the preview output includes a normalized record describing its source-derived transaction data
- **AND** the normalized record includes identification state, transaction identifier, account context, status, date, type, amount, currency, and description fields

#### Scenario: Emit normalized record for an unsupported source shape
- **WHEN** a synchronized Tochka record does not match the supported income and expense slice
- **THEN** the preview output still includes a normalized record for that source entry
- **AND** the normalized record marks the entry as not identified

### Requirement: Preview output separates Honey Money-oriented mapping from the normalized record
The system SHALL keep Honey Money-oriented mapped data in a separate `hmbee` branch rather than mixing target-specific fields into the normalized representation.

#### Scenario: Include Honey Money category mapping in preview output
- **WHEN** a synchronized record is identified and its category can be mapped for Honey Money
- **THEN** the preview output includes the mapped category under the `hmbee` branch for that record

### Requirement: Tochka preview supports only selected statuses for income and expense flows
The Tochka preview flow SHALL identify only records in the currently supported income and expense slice and SHALL treat unsupported statuses as not identified.

#### Scenario: Identify supported Tochka statuses
- **WHEN** a Tochka synchronized record has status `Withdraw` or `InProgress`
- **THEN** the preview flow may identify it as a supported income or expense record subject to the rest of the source-shape rules

#### Scenario: Do not identify rejected Tochka records
- **WHEN** a Tochka synchronized record has status `Rejected`
- **THEN** the preview output marks the record as not identified

### Requirement: Preview category mapping is source-specific
The system SHALL resolve Honey Money category mapping using source-specific configuration rather than a shared hard-coded rule set.

#### Scenario: Map Tochka category from source-specific rules
- **WHEN** an identified Tochka preview record matches a configured Tochka category mapping rule
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: Leave category unmapped when no rule matches
- **WHEN** an identified Tochka preview record does not match any configured Tochka category mapping rule
- **THEN** the preview output leaves the Honey Money category empty or unset

### Requirement: Preview behavior is covered by focused automated tests
The system SHALL provide focused automated tests for preview parsing and mapping behavior in addition to the existing repository quality checks.

#### Scenario: Validate preview normalization rules with automated tests
- **WHEN** the change is validated for completion
- **THEN** focused automated tests cover parsing, status filtering, and category mapping behavior for the preview flow
- **AND** repository quality checks remain part of completion validation
