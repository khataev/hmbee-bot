# source-preview

## Purpose
Preview classification for Tochka source records before apply. TBD.

## Requirements

### Requirement: Preview classification exposes save intent separately from identification
The system SHALL classify each preview record with explicit `identified`, `save`, and `reason` fields.

#### Scenario: Identified record remains save-ready
- **WHEN** a synchronized source record matches exactly one configured `included` condition for its known `type_code`
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`

#### Scenario: Identified record is intentionally excluded
- **WHEN** a synchronized source record matches exactly one configured `excluded` condition for its known `type_code`
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`

#### Scenario: Known record is not identified when no rule matches
- **WHEN** a synchronized source record has a known `type_code` but matches neither configured `included` nor configured `excluded` conditions
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record includes a non-null `reason`

### Requirement: Source preview supports config-driven type-code conditions
The system SHALL read source-specific preview classification rules from the source configuration as `type_codes` dictionaries with `included` and `excluded` condition arrays.

#### Scenario: CardTransactionInfo uses configured conditions
- **WHEN** the Tochka source configuration defines conditions for `CardTransactionInfo`
- **THEN** the preview classifier evaluates those conditions against the source record fields to decide whether the record is included, excluded, or not identified

#### Scenario: Included and excluded ambiguity fails identification
- **WHEN** a source record matches at least one configured `included` condition and at least one configured `excluded` condition for the same known `type_code`
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "included/excluded ambiguity"`

#### Scenario: Card verification and canceled purchases are excluded
- **WHEN** a Tochka `CardTransactionInfo` record matches the configured exclusion for `tranCode = CheckCard` or for a canceled purchase condition
- **THEN** the preview classifier marks the record as identified but excluded from save handling