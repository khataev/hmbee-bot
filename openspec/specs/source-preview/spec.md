# source-preview

## Purpose
Preview classification for Tochka source records before apply. TBD.

## Requirements

### Requirement: Preview classification exposes save intent separately from identification
The system SHALL classify each preview record with explicit `identified`, `save`, and `reason` fields.

#### Scenario: Identified record remains save-ready
- **WHEN** a synchronized source record matches the configured `included` predicate for its known `type_code`
- **AND** the same record does not match the configured `excluded` predicate for that `type_code`
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`

#### Scenario: Identified record is intentionally excluded
- **WHEN** a synchronized source record matches the configured `excluded` predicate for its known `type_code`
- **AND** the same record does not match the configured `included` predicate for that `type_code`
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`

#### Scenario: Known record is not identified when no rule matches
- **WHEN** a synchronized source record has a known `type_code`
- **AND** the record matches neither the configured `included` predicate nor the configured `excluded` predicate for that `type_code`
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record includes a non-null `reason`

### Requirement: Source preview supports config-driven type-code predicates
The system SHALL read source-specific preview classification rules from the source configuration as `type_codes` dictionaries with boolean `included` and `excluded` predicates.

#### Scenario: CardTransactionInfo uses configured predicates
- **WHEN** the Tochka source configuration defines `included` and `excluded` predicates for `CardTransactionInfo`
- **THEN** the preview classifier evaluates those predicates against the source record to decide whether the record is included, excluded, or not identified

#### Scenario: Included and excluded ambiguity fails identification
- **WHEN** a source record matches the configured `included` predicate and the configured `excluded` predicate for the same known `type_code`
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "included/excluded ambiguity"`

#### Scenario: JSON predicate migration preserves existing flat-rule behavior
- **WHEN** existing flat preview conditions are migrated to equivalent JSON predicates for a known `type_code`
- **THEN** the preview classifier preserves the same include, exclude, ambiguity, and no-match outcomes for the same source records

### Requirement: Source preview supports the first SBP income and expense slice
The system SHALL classify the first supported Tochka SBP families in preview when their observed record shape matches the supported income or expense cases.

#### Scenario: SbpC2BPayment is previewed as expense
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2BPayment`
- **AND** the record matches the supported accepted outgoing SBP payment shape
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the expense flow

#### Scenario: SbpC2BRefund is previewed as income
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2BRefund`
- **AND** the record matches the supported accepted incoming SBP refund shape
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the income flow

#### Scenario: Non-transfer SbpB2CPayment is previewed as expense
- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record matches the supported accepted outgoing SBP payment shape
- **AND** the record is not detected as a transfer-like movement between my own accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the expense flow

### Requirement: Transfer-like SBP records are not treated as save-ready income or expense
The system SHALL perform transfer-like detection before assigning the supported SBP income or expense flows.

#### Scenario: Own-account SbpB2CPayment is excluded from save-ready expense flow
- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record matches the supported accepted outgoing SBP payment shape
- **AND** the record is detected as a transfer-like movement between my own accounts using the configured account registry
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`

#### Scenario: This change does not require transfer pairing
- **WHEN** a supported SBP record is detected as transfer-like between my own accounts
- **THEN** the preview classifier does not need to pair mirrored incoming and outgoing transfer legs in order to keep that record out of the save-ready income or expense flow