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

#### Scenario: Emit normalized record for an identified expense, income, or transfer
- **WHEN** a synchronized Tochka record is recognized as a supported expense, income, or transfer record
- **THEN** the preview output includes a normalized record describing its source-derived transaction data
- **AND** the normalized record includes identification state, transaction identifier, account context, status, date, type, amount, currency, and description fields

#### Scenario: Normalized transfer record uses a dedicated transfer type
- **WHEN** a synchronized Tochka record is recognized as a supported transfer record
- **THEN** the normalized preview record has `type = transfer`
- **AND** the record is not normalized as ordinary income or ordinary expense

#### Scenario: Normalized transfer record includes the counterparty account identifier
- **WHEN** a synchronized Tochka record is recognized as a supported transfer record
- **THEN** the normalized preview record includes `counterpartyAccountId`
- **AND** `counterpartyAccountId` identifies the opposite owned account for the transfer

#### Scenario: Non-transfer normalized record does not require the counterparty account identifier
- **WHEN** a synchronized Tochka record is normalized as income, expense, or an unidentified record
- **THEN** the normalized preview record is valid without `counterpartyAccountId`
- **AND** `counterpartyAccountId` is required only when `type = transfer`

#### Scenario: Emit normalized record for an unsupported source shape
- **WHEN** a synchronized Tochka record does not match the supported income, expense, or transfer slice
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

### Requirement: Identified income or expense records require a resolved category to stay save-ready
The system SHALL treat a resolved Honey Money category as mandatory for save-ready income and expense preview records. When a preview record is identified, classified in the income or expense flow (Honey Money `subtype` `i` or `e`), and its resolved `hmbee.category` is `null`, the system SHALL downgrade it to not save-ready with `identified = true`, `save = false`, and `reason = "Category is missing for income or expense transaction"`. This downgrade SHALL take precedence over the save-ready outcome produced by `included`/`excluded` classification.

#### Scenario: Income record with missing category is not save-ready
- **WHEN** a synchronized Tochka source record is identified and classified in the income flow (Honey Money `subtype = i`)
- **AND** category resolution produces `hmbee.category = null` (no MCC or title mapping matched)
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "Category is missing for income or expense transaction"`
- **AND** the preview output still includes the `hmbee` branch for operator inspection

#### Scenario: Expense record with missing category is not save-ready
- **WHEN** a synchronized Tochka source record is identified and classified in the expense flow (Honey Money `subtype = e`)
- **AND** category resolution produces `hmbee.category = null` (no MCC or title mapping matched)
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "Category is missing for income or expense transaction"`
- **AND** the preview output still includes the `hmbee` branch for operator inspection

#### Scenario: Income or expense record with a resolved category stays save-ready
- **WHEN** a synchronized Tochka source record is identified and classified in the income or expense flow
- **AND** category resolution produces a non-null `hmbee.category`
- **THEN** the missing-category downgrade does not apply
- **AND** the preview record keeps the `save` and `reason` values produced by `included`/`excluded` classification

#### Scenario: Transfer records are not subject to the category requirement
- **WHEN** a synchronized Tochka source record is identified and classified in the transfer flow (Honey Money `subtype = t`)
- **AND** the preview record has `hmbee.category = null`
- **THEN** the missing-category downgrade does not apply
- **AND** the preview record keeps the `save` and `reason` values produced by `included`/`excluded` classification

#### Scenario: Unidentified records are not subject to the category requirement
- **WHEN** a synchronized Tochka source record has `identified = false`
- **THEN** the missing-category downgrade does not apply
- **AND** the preview record keeps its existing `save = false` and non-null `reason`

### Requirement: Source preview supports config-driven type-code predicates
The system SHALL read source-specific preview classification rules from the source configuration as `type_codes` dictionaries with boolean `included` and `excluded` predicates.

#### Scenario: Type-code predicates may use shared owned-account context
- **WHEN** the preview classifier evaluates configured predicates for a known source record `type_code`
- **THEN** the rule context includes the shared owned-account registry derived from configured source account mappings
- **AND** the classifier may use that shared owned-account context to distinguish transfer records from non-transfer records

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

#### Scenario: Non-transfer SbpC2CPayment is previewed as income
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2CPayment`
- **AND** the record has `status = DONE` and `incoming = true`
- **AND** the record is not detected as a transfer-like movement between my own accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the income flow

#### Scenario: Outgoing SbpC2CPayment is excluded
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2CPayment`
- **AND** the record has `incoming = false`
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`

#### Scenario: SbpC2CPayment with an unrecognized status is not identified
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2CPayment`
- **AND** the record has `incoming = true` and a status other than `DONE`
- **THEN** the preview record has `identified = false`
- **AND** the preview record is not classified in the save-ready income flow

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
The system SHALL resolve Honey Money category mapping by evaluating both Merchant Category Codes (MCC) and transaction title keywords against mapping rules loaded from `AppConfig` (`hmbee.categoryMapping`). Hardcoded `MCC_MAP` and `TITLE_MAP` constants are removed; all mapping rules come exclusively from config.

#### Scenario: Map Tochka category from MCC
- **WHEN** an identified Tochka preview record has an MCC that matches a mapping entry in `hmbee.categoryMapping.mcc`
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: Map Tochka category from transaction title keyword
- **WHEN** an identified Tochka preview record does not have a matching MCC but its title contains a recognized keyword from `hmbee.categoryMapping.title`
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: MCC match takes priority over title match
- **WHEN** an identified Tochka preview record has both a matching MCC and a matching title keyword that result in different categories
- **THEN** the system SHALL prioritize the MCC match for category assignment

#### Scenario: Mapped description is included in hmbee transaction description
- **WHEN** an identified Tochka preview record matches a mapping entry that has a `description` field
- **THEN** the hmbee transaction `description` in the preview output is `"${Math.abs(amount)} ${entry.description}"`

#### Scenario: No mapped description yields amount-only hmbee description
- **WHEN** an identified Tochka preview record matches a mapping entry without `description`, or matches no entry
- **THEN** the hmbee transaction `description` in the preview output is `String(Math.abs(amount))`

#### Scenario: Empty categoryMapping yields null category
- **WHEN** `hmbee.categoryMapping` contains no entries matching the record's MCC or title
- **THEN** the hmbee category in the preview output is `null`

### Requirement: Source preview supports Tochka transfer-oriented RS records
The system SHALL classify the supported Tochka transfer-oriented RS record families in preview using canonical save behavior for each transfer scenario.

#### Scenario: `PaymentAccepted` is supported in preview
- **WHEN** a synchronized Tochka source record has `type_code = PaymentAccepted`
- **THEN** the preview classifier evaluates configured predicates for that record
- **AND** the normalized transaction identifier for supported records is derived from `corebankingId`

#### Scenario: `PaymentIncome` is supported in preview
- **WHEN** a synchronized Tochka source record has `type_code = PaymentIncome`
- **THEN** the preview classifier evaluates configured predicates for that record
- **AND** the normalized transaction identifier for supported records is derived from `corebankingId`

### Requirement: Source preview distinguishes transfer principal return from transfer income duplicates
The system SHALL keep deposit principal return save-ready while excluding only mirrored duplicate income legs of ordinary own-account transfers.

#### Scenario: Deposit principal return remains save-ready
- **WHEN** a synchronized Tochka source record has `type_code = PaymentIncome`
- **AND** the record represents principal return from a Tochka deposit-like account to an owned account
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`

#### Scenario: Ordinary mirrored transfer income is excluded
- **WHEN** a synchronized Tochka source record has `type_code = PaymentIncome`
- **AND** the record represents the mirrored incoming leg of an ordinary own-account transfer between non-deposit owned accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`

### Requirement: Source preview exposes the opposite owned account for transfer mapping
The system SHALL preserve the resolved opposite owned account on normalized transfer records so transfer intent remains inspectable and mappable.

#### Scenario: Internal transfer exposes the opposite owned account
- **WHEN** a synchronized Tochka source record is normalized as a supported transfer between two owned accounts
- **THEN** the normalized preview record includes `counterpartyAccountId`
- **AND** `counterpartyAccountId` refers to the owned account on the opposite side of the transfer from the current normalized account context

#### Scenario: Deposit principal return exposes the destination owned account as counterparty account
- **WHEN** a synchronized Tochka source record is normalized as a deposit principal return transfer
- **THEN** the normalized preview record includes `counterpartyAccountId`
- **AND** `counterpartyAccountId` refers to the owned non-deposit account that receives the returned principal

### Requirement: Source preview keeps deposit interest in the income flow
The system SHALL treat deposit interest payout as income rather than transfer duplicate when it does not come from an owned or deposit-like account.

#### Scenario: Deposit interest remains save-ready income
- **WHEN** a synchronized Tochka source record has `type_code = PaymentIncome`
- **AND** the record has `incoming = true`
- **AND** the record has `isComission = false`
- **AND** the destination account is an owned account
- **AND** the payer account is neither an owned account nor a Tochka deposit-like account
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the income flow

### Requirement: Preview command accepts --only-errors as a composable modifier
The `apply <source> --preview` command SHALL accept `--only-errors` as an optional boolean modifier. The modifier composes with `--preview` and applies a post-classification output filter; it has no effect on normalization, identification, or save logic.

#### Scenario: --only-errors is valid only in preview mode
- **WHEN** the operator provides `--only-errors` alongside `--preview`
- **THEN** the system applies the error filter to the classified preview records before writing output
- **AND** all other preview behaviour (normalization, mapping, hmbee branch, format) is unchanged

#### Scenario: --only-errors without --preview has no observable effect
- **WHEN** the operator provides `--only-errors` without `--preview`
- **THEN** the system proceeds with the normal apply flow
- **AND** no error or warning is raised for the unused flag

