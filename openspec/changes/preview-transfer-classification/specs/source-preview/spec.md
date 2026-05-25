## MODIFIED Requirements

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

## ADDED Requirements

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
- **AND** the destination account is an owned account
- **AND** the payer account is neither an owned account nor a Tochka deposit-like account
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record is classified in the income flow
