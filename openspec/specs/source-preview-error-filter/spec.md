# source-preview-error-filter

## Purpose
Post-classification output filter for the preview command that restricts output to non-save-ready records when `--only-errors` is active.

## Requirements

### Requirement: Preview supports an error-only filter mode
The system SHALL accept an `--only-errors` flag on the `apply <source> --preview` command. When the flag is active, the preview output SHALL include only records where `identified = false` OR `save = false`. Records that are fully save-ready (`identified = true` AND `save = true`) SHALL be excluded from output.

#### Scenario: Only-errors flag filters out save-ready records
- **WHEN** the operator runs `apply <source> --preview --only-errors`
- **AND** the normalized preview list contains a mix of save-ready and non-save-ready records
- **THEN** the output includes only records where `identified = false` OR `save = false`
- **AND** records where `identified = true` AND `save = true` are not present in the output

#### Scenario: Only-errors flag with no problematic records yields empty output
- **WHEN** the operator runs `apply <source> --preview --only-errors`
- **AND** all normalized preview records have `identified = true` AND `save = true`
- **THEN** the output is an empty array

#### Scenario: Only-errors flag preserves all fields of matching records
- **WHEN** a record is included in the filtered output
- **THEN** the record contains all fields emitted by normal preview (normalized, hmbee, identified, save, reason)
- **AND** no field is omitted or modified by the filter step

#### Scenario: Preview without only-errors flag is unaffected
- **WHEN** the operator runs `apply <source> --preview` without `--only-errors`
- **THEN** all normalized preview records are included in the output regardless of their `identified` or `save` values

### Requirement: Informational messages report both total and error counts when --only-errors is active
The system SHALL include the total number of loaded records and the number of error records in the informational summary when `--only-errors` is active, so the operator can assess the proportion of problematic entries without rerunning without the flag.

#### Scenario: Summary message includes total and error counts
- **WHEN** the operator runs `apply <source> --preview --only-errors` with `--verbose`
- **THEN** the informational summary states the total number of processed records
- **AND** the summary states the number of records included in the filtered (error) output
