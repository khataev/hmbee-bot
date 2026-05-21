## ADDED Requirements

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