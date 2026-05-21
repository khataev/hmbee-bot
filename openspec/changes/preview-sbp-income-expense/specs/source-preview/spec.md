## ADDED Requirements

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