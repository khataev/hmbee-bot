## ADDED Requirements

### Requirement: Apply blocks when unresolved problematic records are present
Non-preview `apply <source>` SHALL, before sending any transaction to Honey Money, inspect the full normalized record set and abort the run if any record is problematic. A record is problematic when `identified = false`, OR when `save = false` and its `reason` is not one of the expected-skip reasons `{ "excluded", "Внесена вручную" }`. When at least one problematic record is present, the system SHALL exit with a non-zero code without sending any transaction, and SHALL print the list of problematic records (source transaction id, description, and reason) so the operator can resolve them. There SHALL be no override flag and no way to skip problematic records. This gate SHALL apply only to non-preview apply; `--preview` and `--preview-planned` SHALL be unaffected.

#### Scenario: Missing category blocks the run
- **WHEN** the operator runs non-preview `apply <source>`
- **AND** the normalized set contains a record with `save = false` and `reason = "Category is missing for income or expense transaction"`
- **THEN** the system exits with a non-zero code
- **AND** no transaction is sent to Honey Money
- **AND** the output lists the problematic record with its id and reason

#### Scenario: Not-identified record blocks the run
- **WHEN** the normalized set contains a record with `identified = false` (parse error, unsupported type_code, or missing required field)
- **THEN** non-preview `apply <source>` exits with a non-zero code without sending any transaction
- **AND** the output lists the not-identified record with its reason

#### Scenario: Expected skips do not block the run
- **WHEN** every non-save-ready record in the normalized set has `reason` equal to `"excluded"` or `"Внесена вручную"`
- **AND** the remaining records are save-ready
- **THEN** non-preview `apply <source>` proceeds and sends the save-ready records as before

#### Scenario: Clean set applies normally
- **WHEN** the normalized set contains only save-ready records
- **THEN** non-preview `apply <source>` sends them without any gate error

#### Scenario: --only-id does not bypass the gate
- **WHEN** the operator runs `apply <source> --only-id <id-list>`
- **AND** the full normalized set contains a problematic record (even one outside the id list)
- **THEN** the system aborts with a non-zero code and sends nothing

#### Scenario: Preview modes are not gated
- **WHEN** the operator runs `apply <source> --preview` or `apply <source> --preview-planned`
- **AND** the normalized set contains problematic records
- **THEN** the preview output is produced normally and the gate does not abort the command
