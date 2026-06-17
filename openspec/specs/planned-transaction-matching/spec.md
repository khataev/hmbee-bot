# planned-transaction-matching

## Purpose
Matching normalized source transactions against unconfirmed Honey Money planned transactions to produce confirmation drafts instead of create drafts.

## Requirements

### Requirement: Apply matches real transactions to unconfirmed planned transactions
The system SHALL match each normalized source transaction against the unconfirmed planned transactions from the Honey Money cache and, on a match, SHALL turn the record's `hmbee` draft into a confirmation of the matched plan rather than a create draft.

#### Scenario: Matched record carries a confirm-shaped hmbee draft
- **WHEN** `apply <source>` processes a normalized record that matches exactly one eligible planned transaction
- **THEN** the record's `hmbee` draft is a confirmation of that plan: it carries the plan `id`, `type=planned`, the plan `plan_amount`, `common_id`, and `virtual_id`
- **AND** `real_amount` is set to the normalized bank amount and `date` is set to the bank transaction date
- **AND** the record is marked `identified=true`, `save=true`, `reason=null` following the ordinary rules
- **AND** the record's `plannedMatchStatus` is `matched-exact` for an exact amount or `matched-tolerance` within ±20%

#### Scenario: Create vs confirm is distinguished by the hmbee id
- **WHEN** a record's `hmbee` draft has a non-null `id`
- **THEN** it represents a confirmation (update) of an existing planned transaction
- **AND** when `id` is null it represents a create, matching the Honey Money endpoint semantics

#### Scenario: No matching plan leaves the record on the create path
- **WHEN** `apply <source>` processes a normalized record that matches no eligible planned transaction
- **THEN** the record's `hmbee` stays a create draft (`id=null`) with `save=true` and `reason=null`
- **AND** the record's `plannedMatchStatus` is `no-candidate`, `out-of-tolerance`, or `ambiguous` as appropriate

### Requirement: Planned-match candidates are unconfirmed plans only
The system SHALL consider as candidates only Honey Money cache records that are planned and not yet confirmed, identified by a present plan amount and an absent real amount.

#### Scenario: Eligible candidate set
- **WHEN** the candidate set is built from the Honey Money cache
- **THEN** it includes records with `type=planned`, a present `plan_amount`, and `real_amount == null`
- **AND** it excludes planned records that already have a `real_amount`
- **AND** it excludes unplanned records

### Requirement: Default match key uses account, direction, category, and amount tolerance
The system SHALL match by Honey Money account, direction, category, and amount within a tolerance of plus or minus twenty percent of the plan amount, limited to the calendar month of the source transaction.

#### Scenario: Match within tolerance and month
- **WHEN** a normalized record shares account, direction, and category with an unconfirmed plan in the same calendar month
- **AND** the rounded source amount is within ±20% of the plan amount
- **THEN** the plan is a match candidate

#### Scenario: Amount outside tolerance is not a match
- **WHEN** a candidate shares account, direction, and category but the rounded source amount differs from the plan amount by more than 20%
- **THEN** it is not a match and the record stays a create draft with `save=true`
- **AND** the `plannedMatchStatus` is `out-of-tolerance` when no other candidate matches

#### Scenario: Direction must agree
- **WHEN** a candidate plan has a different direction (expense, income, or transfer) than the normalized record
- **THEN** it is not a match

#### Scenario: Transfer matching ignores category
- **WHEN** the normalized record is a transfer
- **THEN** category is not part of the match key
- **AND** matching uses account, direction, amount tolerance, and month

### Requirement: Matching is one-to-one with a deterministic tie-break
The system SHALL match each plan to at most one source transaction and SHALL resolve multiple candidates by choosing the nearest plan by date and then by amount.

#### Scenario: Single candidate is matched
- **WHEN** exactly one eligible plan satisfies the match key for a normalized record
- **THEN** that plan is matched with `plannedMatchStatus` `matched-exact` for an exact amount or `matched-tolerance` within ±20%

#### Scenario: Multiple candidates resolved by nearest date then amount
- **WHEN** more than one eligible plan satisfies the match key for a normalized record
- **THEN** the system selects the candidate closest by date, breaking ties by closest amount
- **AND** a selected plan is not reused for another source transaction

#### Scenario: Ambiguous match is reported
- **WHEN** more than one eligible plan satisfies the match key and the tie-break cannot select a single plan
- **THEN** the record carries `plannedMatchStatus` `ambiguous`
- **AND** the record is not matched to any single plan and stays a create draft with `save=true`
