## ADDED Requirements

### Requirement: Tochka sync period boundaries account for source timezone
The system SHALL construct the `start_date`/`end_date` boundaries of a Tochka timeline request using the configured source timezone offset (`time_zone`), rather than treating the requested `--from`/`--to` calendar dates as literal UTC-day boundaries.

#### Scenario: Early-local-morning event stays inside its requested day's sync window
- **WHEN** the operator runs sync for a single calendar day
- **AND** a Tochka record's `event_date` falls within the first hours of that calendar day in the source timezone (e.g. between `00:00` and `05:00` at `+05:00`)
- **THEN** the system SHALL include that record in the requested day's sync window
- **AND** SHALL NOT exclude it merely because its UTC-converted instant falls on the previous UTC calendar day

#### Scenario: Daytime event sync behavior is unchanged
- **WHEN** a Tochka record's `event_date` falls within the middle of the requested calendar day in the source timezone
- **THEN** the system SHALL include that record in the requested day's sync window, consistent with prior behavior
