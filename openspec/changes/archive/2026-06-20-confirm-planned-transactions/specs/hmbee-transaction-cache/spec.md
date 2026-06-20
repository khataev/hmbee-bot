## ADDED Requirements

### Requirement: Cached entries retain plan recurrence fields
The system SHALL retain the plan recurrence fields when caching Honey Money transactions, so the confirmation payload can echo them back without an extra fetch.

#### Scenario: Recurrence fields survive caching
- **WHEN** Honey Money transactions are fetched and written to the cache
- **THEN** each cached entry retains `planned_repeat_days`, `planned_repeat_end`, and `planned_repeat_end_date` when present

#### Scenario: Confirmation echoes cached recurrence
- **WHEN** a confirmation payload is built from a cached plan
- **THEN** the plan recurrence fields come from the cached entry
- **AND** no additional Honey Money request is needed to obtain them
