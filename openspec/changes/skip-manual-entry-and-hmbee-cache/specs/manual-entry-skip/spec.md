## ADDED Requirements

### Requirement: Apply skips transactions already entered in Honey Money
The system SHALL detect synchronized source transactions that already exist in the Honey Money cache as manually entered records and exclude them from the write path while keeping them visible in preview output.

#### Scenario: Skip a transaction already entered manually
- **WHEN** `apply <source>` processes a normalized record that matches an existing Honey Money cache record
- **THEN** the record is marked `identified=true`, `save=false`, `reason="Внесена вручную"`
- **AND** the record is not sent to the Honey Money write path
- **AND** the record appears in `apply <source> --preview` output

#### Scenario: Keep a transaction that has no Honey Money match
- **WHEN** `apply <source>` processes a normalized record that has no matching Honey Money cache record
- **THEN** the skip step does not change the record's `identified`, `save`, or `reason`

### Requirement: Skip matching considers only really-entered Honey Money records
The system SHALL include in the matching index only Honey Money records that represent really-entered transactions, identified by the presence of a real amount.

#### Scenario: Confirmed planned and unplanned records are eligible
- **WHEN** the matching index is built from the Honey Money cache
- **THEN** unplanned records and planned records that have a real amount are included
- **AND** planned records that have only a plan amount (no real amount) are excluded

### Requirement: Skip matching key uses account, date, amount, direction, and category
The system SHALL match a normalized source transaction to a Honey Money record by Honey Money account, date, rounded amount, direction, and category, and SHALL omit category for transfers because transfer records carry no category.

#### Scenario: Match an income or expense by full key
- **WHEN** a normalized income or expense record is compared to the matching index
- **THEN** it matches a Honey Money record with the same account, date, rounded absolute amount, direction, and category

#### Scenario: Match a transfer without category
- **WHEN** a normalized transfer record is compared to the matching index
- **THEN** category is not part of the key
- **AND** it matches a Honey Money record with the same account, date, rounded absolute amount, and transfer direction

#### Scenario: Amounts and dates are normalized before comparison
- **WHEN** a source record with a decimal amount or a card-style date is compared
- **THEN** the amount is compared after rounding to the nearest integer
- **AND** the date is taken from the source transaction date with a fallback to the event date for card records

### Requirement: Each Honey Money record is consumed at most once
The system SHALL match source transactions to Honey Money records one-to-one so that multiple source transactions with the same key do not all collapse onto a single Honey Money record.

#### Scenario: Two identical source transactions, one Honey Money record
- **WHEN** two normalized source records share the same matching key and only one Honey Money record exists for that key
- **THEN** exactly one source record is marked as skipped
- **AND** the other source record remains eligible for the write path
