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

### Requirement: Apply refreshes the Honey Money cache before the skip pass
The system SHALL refresh the local Honey Money cache before building the manual-entry skip index on every `apply <source>` run, including `--preview` and `--preview-planned`, unless the operator passes `--skip-hmbee-cache-update`. The refresh SHALL fetch current Honey Money transactions, trim them using the sync file's start date as the boundary, and overwrite the cache file, so the skip pass always operates on current Honey Money state and repeated apply runs do not create duplicate transactions. If the refresh fails, the system SHALL abort the run with a classified error and MUST NOT send or preview any records, and the error MUST NOT expose full cookie/session/token values.

#### Scenario: Refresh runs before the skip pass on a non-preview apply
- **WHEN** the operator runs non-preview `apply <source>` without `--skip-hmbee-cache-update`
- **THEN** the system refreshes the Honey Money cache before computing the skip index
- **AND** records already present in the refreshed cache are marked as manual entries and are not sent again

#### Scenario: Repeated apply does not duplicate transactions
- **WHEN** the operator runs `apply <source>`, then runs the same `apply <source>` again without manually updating the cache
- **THEN** the second run refreshes the cache before the skip pass and skips the transactions created by the first run
- **AND** no duplicate transaction is sent to Honey Money

#### Scenario: Refresh also runs in preview modes
- **WHEN** the operator runs `apply <source> --preview` or `apply <source> --preview-planned` without `--skip-hmbee-cache-update`
- **THEN** the system refreshes the Honey Money cache before producing the preview output

#### Scenario: Opt-out skips the refresh
- **WHEN** the operator runs `apply <source> --skip-hmbee-cache-update`
- **THEN** the system does not fetch Honey Money transactions
- **AND** the skip pass uses the existing cache file unchanged

#### Scenario: Refresh failure aborts the run
- **WHEN** the Honey Money cache refresh fails during `apply <source>` without `--skip-hmbee-cache-update`
- **THEN** the system exits with a non-zero code without sending or previewing any records
- **AND** the error message does not expose full cookie/session/token values

#### Scenario: Trimming boundary comes from the sync file
- **WHEN** the cache is refreshed during `apply <source>` for a sync file named `<from>_<to>.json`
- **THEN** the trimming boundary uses `<from>` as the sync window start

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