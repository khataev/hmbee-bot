# planned-transaction-matching

## Purpose
Matching normalized source transactions against unconfirmed Honey Money planned transactions to produce confirmation drafts instead of create drafts.

## Requirements

### Requirement: Apply matches real transactions to unconfirmed planned transactions
The system SHALL match each normalized source transaction against the unconfirmed planned transactions from the Honey Money cache and, on a match, SHALL turn the record's `hmbee` draft into a confirmation of the matched plan rather than a create draft. The outcome of matching SHALL be reported on the record as a structured `planMatch` object carrying a `status`.

#### Scenario: Matched record carries a confirm-shaped hmbee draft
- **WHEN** `apply <source>` processes a normalized record that matches exactly one eligible planned transaction
- **THEN** the record's `hmbee` draft is a confirmation of that plan: it carries the plan `id`, `type=planned`, the plan `plan_amount`, `common_id`, and `virtual_id`
- **AND** `real_amount` is set to the normalized bank amount and `date` is set to the bank transaction date
- **AND** the record is marked `identified=true`, `save=true`, `reason=null` following the ordinary rules
- **AND** the record's `planMatch.status` is `matched-exact` for an exact amount or `matched-tolerance` within ±20%

#### Scenario: Create vs confirm is distinguished by the hmbee id
- **WHEN** a record's `hmbee` draft has a non-null `id`
- **THEN** it represents a confirmation (update) of an existing planned transaction
- **AND** when `id` is null it represents a create, matching the Honey Money endpoint semantics

#### Scenario: No matching plan leaves the record on the create path
- **WHEN** `apply <source>` processes a normalized record that matches no eligible planned transaction
- **THEN** the record's `hmbee` stays a create draft (`id=null`) with `save=true` and `reason=null`
- **AND** the record's `planMatch.status` is `no-candidate`, `out-of-tolerance`, `ambiguous`, or `beaten-match` as appropriate

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
- **AND** the `planMatch.status` is `out-of-tolerance` when no other candidate matches

#### Scenario: Direction must agree
- **WHEN** a candidate plan has a different direction (expense, income, or transfer) than the normalized record
- **THEN** it is not a match

#### Scenario: Transfer matching ignores category
- **WHEN** the normalized record is a transfer
- **THEN** category is not part of the match key
- **AND** matching uses account, direction, amount tolerance, and month

### Requirement: Matching is one-to-one with a deterministic tie-break
The system SHALL match each plan to at most one source transaction and each source transaction to at most one plan. The system SHALL resolve all candidates within a bucket (account, direction, category, month) jointly rather than in source-file order: it SHALL consider the bipartite set of real-to-plan pairs that lie within tolerance, weight each pair by closeness (nearest amount, then nearest date), and assign greedily by closest pair first, consuming both ends of each assigned pair. The result SHALL NOT depend on the order of records in the source file.

#### Scenario: Single candidate is matched
- **WHEN** exactly one eligible plan satisfies the match key for a normalized record and no other record competes for it
- **THEN** that plan is matched with `planMatch.status` `matched-exact` for an exact amount or `matched-tolerance` within ±20%

#### Scenario: Multiple plans for one real resolved by nearest amount then date
- **WHEN** more than one eligible plan satisfies the match key for a single normalized record
- **THEN** the system selects the candidate closest by amount, breaking ties by closest date
- **AND** a selected plan is not reused for another source transaction

#### Scenario: Multiple reals competing for one plan resolved by closeness, not file order
- **WHEN** two or more normalized records lie within tolerance of the same plan
- **THEN** the plan is assigned to the record whose amount (then date) is closest to the plan, regardless of the records' order in the source file
- **AND** the closest record carries `matched-exact` or `matched-tolerance`
- **AND** each losing record that had this plan as its only in-tolerance candidate carries `planMatch.status` `beaten-match`

#### Scenario: Exact competitor wins the plan over a near one-off
- **WHEN** a one-off record and an exact record both lie within ±20% of the same plan in one bucket, and the one-off appears earlier in the source file
- **THEN** the exact record (distance 0) is assigned the plan
- **AND** the one-off record stays a create draft with `save=true` and `planMatch.status` `beaten-match`

#### Scenario: Ambiguous match is reported symmetrically
- **WHEN** the closest assignment is tied at equal distance over a shared end — one record equidistant between two plans, or one plan equidistant between two records
- **THEN** the affected record carries `planMatch.status` `ambiguous`
- **AND** the record is not matched to any single plan and stays a create draft with `save=true`

### Requirement: Plan-match outcome is a structured object with beaten-match diagnostics
The system SHALL report the result of planned matching on each processed record as a `planMatch` object containing a `status`. For records displaced from an in-tolerance plan by a closer competitor, the system SHALL set `status` to `beaten-match` and SHALL record the contested plan and the winning transaction for debugging.

#### Scenario: PlanMatch carries status for every processed record
- **WHEN** a record is processed by the match pass
- **THEN** it carries a `planMatch` object whose `status` is one of `matched-exact`, `matched-tolerance`, `no-candidate`, `out-of-tolerance`, `ambiguous`, or `beaten-match`

#### Scenario: Beaten record records the lost plan and the winner
- **WHEN** a record's `planMatch.status` is `beaten-match`
- **THEN** `planMatch.lostPlanId` is the `id` of the plan it was within tolerance of but did not receive
- **AND** `planMatch.beatenById` is the `transactionId` (string) of the competing record that received that plan

#### Scenario: Diagnostic fields are absent unless beaten
- **WHEN** a record's `planMatch.status` is anything other than `beaten-match`
- **THEN** `planMatch.lostPlanId` and `planMatch.beatenById` are absent
- **AND** for a matched record the plan id is carried on the `hmbee` draft, not duplicated in `planMatch`

### Requirement: Beaten-match records remain visible in the planned view
The system SHALL treat `beaten-match` records as plan-relevant near-misses and SHALL include them in the planned preview view, unlike `no-candidate` records which are ordinary creates excluded from that view.

#### Scenario: Beaten-match is shown, no-candidate is hidden
- **WHEN** the planned preview view is built from processed records
- **THEN** records with `planMatch.status` `beaten-match` are included alongside matched, `out-of-tolerance`, and `ambiguous` records
- **AND** records with `planMatch.status` `no-candidate` (or no `planMatch`) are excluded as ordinary creates
