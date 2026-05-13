# source-apply

## Purpose
Writing identified source transactions to Honey Money via the apply operation with validation, normalization, and result reporting.

## Requirements

### Requirement: Apply preview emits a save-ready Honey Money draft
The system SHALL expand the `hmbee` branch for identified synchronized records into the full Honey Money transaction draft used by the write path.

#### Scenario: Preview an identified expense as a Honey Money draft
- **WHEN** the operator runs `apply <source> --preview` for a synchronized Tochka expense record that is identified and mapped to a Honey Money account
- **THEN** the preview output includes a full `hmbee` draft with subtype, date, account id, currency, category, description, repeat defaults, and final `real_amount`

#### Scenario: Preview an identified income as a Honey Money draft
- **WHEN** the operator runs `apply <source> --preview` for a synchronized Tochka income record that is identified and mapped to a Honey Money account
- **THEN** the preview output includes the same full `hmbee` draft shape
- **AND** the draft uses the Honey Money income subtype and a positive final `real_amount`

### Requirement: Apply saves only identified income and expense transactions by default
The system SHALL send only identified synchronized income and expense records to Honey Money when the operator runs `apply <source>` without preview mode.

#### Scenario: Skip unsupported records during apply
- **WHEN** the synchronized input contains both identified and not-identified records
- **THEN** the apply flow sends only the identified records to Honey Money
- **AND** the unsupported records are skipped rather than forced through the write path

### Requirement: Apply requires configured Honey Money account mapping
The system SHALL resolve Honey Money account identifiers from configured Tochka account mappings before writing any transaction.

#### Scenario: Fail when account mapping is missing
- **WHEN** an identified record selected for apply does not have a configured Tochka account to Honey Money account mapping
- **THEN** the system fails before sending that apply batch
- **AND** the error identifies the missing Tochka account mapping

### Requirement: Apply normalizes final amounts for Honey Money writes
The system SHALL normalize source amounts to the Honey Money integer amount format before building the outbound transaction payload.

#### Scenario: Normalize an expense amount
- **WHEN** an identified expense record with a decimal source amount is prepared for Honey Money
- **THEN** the system rounds the absolute amount to the nearest integer
- **AND** it writes the final Honey Money `real_amount` as a negative integer value

#### Scenario: Normalize an income amount
- **WHEN** an identified income record with a decimal source amount is prepared for Honey Money
- **THEN** the system rounds the absolute amount to the nearest integer
- **AND** it writes the final Honey Money `real_amount` as a positive integer value

### Requirement: Apply can target specific source transaction ids
The system SHALL allow the operator to limit a non-preview apply run to a comma-separated subset of source transaction ids.

#### Scenario: Save only explicitly selected ids
- **WHEN** the operator runs `apply <source> --only-id <id-list>`
- **THEN** the system applies only identified records whose source transaction ids are in the provided list
- **AND** identified records outside that list are skipped for that run

### Requirement: Apply reports created Honey Money transaction identifiers
The system SHALL capture the created Honey Money transaction identifiers returned by the Honey Money API and include them in the command output.

#### Scenario: Report created ids after successful apply
- **WHEN** the Honey Money API accepts a transaction created by the apply flow
- **THEN** the system outputs the source transaction id together with the created Honey Money transaction id
- **AND** the output remains structured so later persistence work can consume the same contract