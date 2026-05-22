# source-preview

## Purpose
Preview classification for Tochka source records before apply. TBD.

## Requirements

### Requirement: CLI can preview normalized source records from synchronized files
The system SHALL provide an `apply <source> --preview` flow that reads synchronized source files from `sync/<source>` and emits operator-inspectable preview output without writing to Honey Money.

#### Scenario: Preview synchronized records for a supported source
- **WHEN** the operator runs the preview flow for a supported source with a single synchronized input file available under `sync/<source>`
- **THEN** the system reads the synchronized source data from that file
- **AND** the system emits preview output without sending any Honey Money write request

#### Scenario: Fail if multiple synchronized files exist
- **WHEN** the operator runs the preview flow for a source and `sync/<source>` contains more than one JSON file
- **THEN** the system fails with an informative error message about multiple files

### Requirement: Preview output includes a normalized internal representation
The system SHALL emit a normalized representation for each previewed record so that source-derived meaning is inspectable independently from Honey Money-specific mapping.

#### Scenario: Emit normalized record for an identified expense or income
- **WHEN** a synchronized Tochka record is recognized as a supported income or expense record
- **THEN** the preview output includes a normalized record describing its source-derived transaction data
- **AND** the normalized record includes identification state, transaction identifier, account context, status, date, type, amount, currency, and description fields

#### Scenario: Emit normalized record for an unsupported source shape
- **WHEN** a synchronized Tochka record does not match the supported income and expense slice
- **THEN** the preview output still includes a normalized record for that source entry
- **AND** the normalized record marks the entry as not identified

### Requirement: Preview output separates Honey Money-oriented mapping from the normalized record
The system SHALL keep Honey Money-oriented mapped data in a separate `hmbee` branch rather than mixing target-specific fields into the normalized representation.

#### Scenario: Include Honey Money category mapping in preview output
- **WHEN** a synchronized record is identified and its category can be mapped for Honey Money
- **THEN** the preview output includes the mapped category under the `hmbee` branch for that record

### Requirement: Tochka preview supports only selected statuses for income and expense flows
The Tochka preview flow SHALL identify only records in the currently supported income and expense slice and SHALL treat unsupported statuses as not identified.

#### Scenario: Identify supported Tochka statuses
- **WHEN** a Tochka synchronized record has status `Withdraw` or `InProgress`
- **THEN** the preview flow may identify it as a supported income or expense record subject to the rest of the source-shape rules

#### Scenario: Do not identify rejected Tochka records
- **WHEN** a Tochka synchronized record has status `Rejected`
- **THEN** the preview output marks the record as not identified

### Requirement: Preview behavior is covered by focused automated tests
The system SHALL provide focused automated tests for preview parsing and mapping behavior in addition to the existing repository quality checks.

#### Scenario: Validate preview normalization rules with automated tests
- **WHEN** the change is validated for completion
- **THEN** focused automated tests cover parsing, status filtering, and category mapping behavior for the preview flow
- **AND** repository quality checks remain part of completion validation

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

### Requirement: Source preview supports the first SBP income and expense slice
The system SHALL classify the first supported Tochka SBP families in preview when their observed record shape matches the supported income or expense cases.

#### Scenario: SbpC2BPayment is previewed as expense
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2BPayment`
- **AND** the record matches the supported accepted outgoing SBP payment shape
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the expense flow

#### Scenario: SbpC2BRefund is previewed as income
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2BRefund`
- **AND** the record matches the supported accepted incoming SBP refund shape
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the income flow

#### Scenario: Non-transfer SbpB2CPayment is previewed as expense
- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record matches the supported accepted outgoing SBP payment shape
- **AND** the record is not detected as a transfer-like movement between my own accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the expense flow

### Requirement: Transfer-like SBP records are not treated as save-ready income or expense
The system SHALL perform transfer-like detection before assigning the supported SBP income or expense flows.

#### Scenario: Own-account SbpB2CPayment is excluded from save-ready expense flow
- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record matches the supported accepted outgoing SBP payment shape
- **AND** the record is detected as a transfer-like movement between my own accounts using the configured account registry
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`

#### Scenario: This change does not require transfer pairing
- **WHEN** a supported SBP record is detected as transfer-like between my own accounts
- **THEN** the preview classifier does not need to pair mirrored incoming and outgoing transfer legs in order to keep that record out of the save-ready income or expense flow

### Requirement: Source preview supports the first `PaymentWrittenOff` expense and exclusion slice
The system SHALL classify the first supported Tochka `PaymentWrittenOff` record shapes in preview without widening transfer handling beyond the observed exclusion slice.

#### Scenario: Commission-like `PaymentWrittenOff` is previewed as expense
- **WHEN** a synchronized Tochka source record has `type_code = PaymentWrittenOff`
- **AND** the record matches the supported processed outgoing commission shape
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`
- **AND** the preview record is classified in the expense flow

#### Scenario: Transfer-like `PaymentWrittenOff` is excluded from save-ready expense flow
- **WHEN** a synchronized Tochka source record has `type_code = PaymentWrittenOff`
- **AND** the record matches the observed transfer-like write-off shape
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`

#### Scenario: Unconfirmed `PaymentWrittenOff` shape remains unmatched
- **WHEN** a synchronized Tochka source record has `type_code = PaymentWrittenOff`
- **AND** the record matches neither the supported commission include slice nor the supported transfer-like exclude slice
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record includes a non-null `reason`

### Requirement: Source preview supports the first `VedPaymentIncome` income slice
The system SHALL classify the first supported Tochka `VedPaymentIncome` record shape in preview while leaving unconfirmed arrival states unmatched.

#### Scenario: Undistributed `VedPaymentIncome` is previewed as income
- **WHEN** a synchronized Tochka source record has `type_code = VedPaymentIncome`
- **AND** the record matches the supported undistributed incoming arrival shape for one of my configured accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`
- **AND** the preview record is classified in the income flow

#### Scenario: Unconfirmed `VedPaymentIncome` state remains unmatched
- **WHEN** a synchronized Tochka source record has `type_code = VedPaymentIncome`
- **AND** the record does not match the supported undistributed incoming arrival shape
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record includes a non-null `reason`

### Requirement: Map Tochka category from source-specific rules
The system SHALL resolve Honey Money category mapping by evaluating both Merchant Category Codes (MCC) and transaction title keywords against a set of mapping rules for Tochka.

#### Scenario: Map Tochka category from MCC
- **WHEN** an identified Tochka preview record has an MCC that matches a mapping rule (e.g., `5411` or `5499` for `Покупки / Продукты`)
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: Map Tochka category from transaction title keyword
- **WHEN** an identified Tochka preview record does not have a matching MCC but its title contains a recognized keyword (e.g., `Whoosh` for `Услуги / Аренда самокатов`)
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: MCC match takes priority over title match
- **WHEN** an identified Tochka preview record has both a matching MCC and a matching title keyword that result in different categories
- **THEN** the system SHALL prioritize the MCC match for category assignment