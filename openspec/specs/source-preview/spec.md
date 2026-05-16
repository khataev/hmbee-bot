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