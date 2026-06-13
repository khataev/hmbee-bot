## MODIFIED Requirements

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
