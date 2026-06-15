## ADDED Requirements

### Requirement: Preview shows the planned-transaction match result
The system SHALL make the planned-transaction match visible in `apply <source> --preview`, so the operator can see whether a record will confirm an existing plan instead of creating a new transaction.

#### Scenario: Preview a record matched to a plan
- **WHEN** the operator runs `apply <source> --preview` for a record matched to an unconfirmed plan
- **THEN** the record's `hmbee` draft is shown as a confirmation of the matched plan (non-null plan `id`, `type=planned`) rather than a create draft
- **AND** the record carries its match status

#### Scenario: Preview a record with no plan match
- **WHEN** the operator runs `apply <source> --preview` for a record that matched no plan
- **THEN** the preview output shows the ordinary create draft (`hmbee.id=null`)

### Requirement: Preview can be filtered to plan-relevant records and unmatched plans
The system SHALL provide a `--preview-planned` flag that emits the plan-relevant records — those matched to a plan and the candidates (`out-of-tolerance`, `ambiguous`) — together with the source's unconfirmed planned transactions that were not matched, for the period under consideration. Records with `plannedMatchStatus` `no-candidate` SHALL be excluded.

#### Scenario: Show matched records, candidates, and unmatched plans
- **WHEN** the operator runs `apply <source> --preview-planned`
- **THEN** the output includes records whose `hmbee` is a plan confirmation (`matched-exact`, `matched-tolerance`), each showing its matched plan and `plannedMatchStatus`
- **AND** the output includes candidate records with `plannedMatchStatus` `out-of-tolerance` or `ambiguous`
- **AND** the output includes the source's unconfirmed planned transactions that no record matched
- **AND** records with `plannedMatchStatus` `no-candidate` are not included

#### Scenario: Unmatched plans are scoped to the source
- **WHEN** the unmatched planned transactions are listed
- **THEN** they are limited to plans on the Honey Money accounts mapped to the requested source
- **AND** they are limited to the period under consideration

#### Scenario: Nothing plan-relevant found
- **WHEN** the operator runs `apply <source> --preview-planned` and there are no matched records, no candidates, and no unmatched plans for the period
- **THEN** the output contains no entries
