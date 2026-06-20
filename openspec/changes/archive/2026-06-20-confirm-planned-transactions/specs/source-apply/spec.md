## REMOVED Requirements

### Requirement: Apply write path sends only create drafts in this change
**Reason**: Confirmation execution is now implemented; the temporary deferral is replaced by sending confirmation drafts.
**Migration**: Replaced by "Apply write path sends create and confirmation drafts".

## ADDED Requirements

### Requirement: Apply write path sends create and confirmation drafts
The system SHALL send both create drafts (`hmbee.id == null`) and confirmation drafts (`hmbee.id != null`) to Honey Money during non-preview apply, routing each by the presence of `hmbee.id`.

#### Scenario: Create drafts are created
- **WHEN** non-preview `apply <source>` processes a save-ready record whose `hmbee.id` is null
- **THEN** the system sends it to the Honey Money create path

#### Scenario: Confirmation drafts are confirmed
- **WHEN** non-preview `apply <source>` processes a save-ready record whose `hmbee.id` is non-null
- **THEN** the system sends it to the Honey Money confirmation path (POST with that `id`)
- **AND** the matched plan is confirmed rather than duplicated

#### Scenario: Verbose run reports created and confirmed counts
- **WHEN** non-preview `apply <source> --verbose` completes
- **THEN** the system reports how many records were created and how many plans were confirmed

### Requirement: Apply can send transactions one by one with manual confirmation
The system SHALL provide a `--one-by-one` modifier for non-preview apply that, before each Honey Money write, shows the pending transaction and asks the operator to confirm, send, skip, or quit.

#### Scenario: Confirm a single send
- **WHEN** non-preview `apply <source> --one-by-one` reaches a save-ready record
- **THEN** the system prints a one-line summary of the transaction: date, subtype (`e`/`i`/`t`), category, and `hmbee.description`
- **AND** the line indicates whether it is a create or a plan confirmation
- **AND** the system sends it only after the operator confirms

#### Scenario: Skip a single record
- **WHEN** the operator declines a record at the prompt
- **THEN** the system does not send that record and continues to the next

#### Scenario: Quit stops remaining sends
- **WHEN** the operator chooses to quit at the prompt
- **THEN** the system stops without sending any remaining records

#### Scenario: Flag is inert in preview
- **WHEN** `--one-by-one` is combined with `--preview` or `--preview-planned`
- **THEN** no prompts are shown and nothing is sent, since preview never writes

