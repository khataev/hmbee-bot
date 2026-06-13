# tochka-transfer-preview Specification

## Purpose
TBD - created by archiving change preview-transfer-classification. Update Purpose after archive.
## Requirements
### Requirement: Tochka preview classifies supported transfer records with canonical save behavior
The system SHALL classify supported Tochka transfer records so that one canonical record remains save-ready for each supported transfer scenario and only mirrored duplicate legs are excluded.

#### Scenario: Internal own-account transfer keeps `PaymentAccepted` as canonical record
- **WHEN** a synchronized Tochka source record has `type_code = PaymentAccepted`
- **AND** the record has `incoming = false`
- **AND** the record has `isComission = false`
- **AND** both payer and payee accounts are owned accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record includes `counterpartyAccountId`

#### Scenario: Mirrored internal own-account transfer excludes `PaymentIncome`
- **WHEN** a synchronized Tochka source record has `type_code = PaymentIncome`
- **AND** the record has `incoming = true`
- **AND** the record has `isComission = false`
- **AND** both payer and payee accounts are owned accounts
- **AND** neither account is a Tochka deposit-like account
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`

#### Scenario: Deposit opening keeps `PaymentWrittenOff` as canonical transfer record
- **WHEN** a synchronized Tochka source record has `type_code = PaymentWrittenOff`
- **AND** the record has `incoming = false`
- **AND** the record has `isComission = false`
- **AND** the payer account is an owned account
- **AND** the payee account is a Tochka deposit-like account
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record includes `counterpartyAccountId`

#### Scenario: Deposit principal return keeps `PaymentIncome` as canonical transfer record
- **WHEN** a synchronized Tochka source record has `type_code = PaymentIncome`
- **AND** the record has `incoming = true`
- **AND** the record has `isComission = false`
- **AND** the payer account is a Tochka deposit-like account
- **AND** the payee account is an owned account
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record includes `counterpartyAccountId`

#### Scenario: Own external-account SBP transfer remains save-ready
- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record has `incoming = false`
- **AND** the record has `status = ACCEPTED`
- **AND** the payer account is an owned account
- **AND** the payee account is an owned account
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record includes `counterpartyAccountId`

### Requirement: Tochka transfer normalization always resolves the opposite owned account
The system SHALL emit `counterpartyAccountId` for every normalized Tochka transfer record.

#### Scenario: Save-ready transfer record always carries `counterpartyAccountId`
- **WHEN** a synchronized Tochka source record is identified as a save-ready transfer
- **THEN** the normalized preview record includes `counterpartyAccountId`
- **AND** `counterpartyAccountId` identifies the owned account on the opposite side of the transfer

### Requirement: Tochka preview recognizes deposit-like accounts without static configuration
The system SHALL recognize Tochka auto-opened deposit accounts through a source-specific heuristic rather than requiring every temporary deposit account to be listed in source configuration.

#### Scenario: Tochka `421*` account with Tochka BIC is treated as deposit-like owned account
- **WHEN** a synchronized Tochka source record references an account whose number begins with `421`
- **AND** the corresponding payer or payee bank BIC for that account is `044525104`
- **THEN** the preview classifier treats that account as an owned deposit-like account for Tochka transfer classification

#### Scenario: Tochka BIC alone does not imply owned deposit account
- **WHEN** a synchronized Tochka source record references an account that does not begin with `421`
- **AND** the corresponding bank BIC is `044525104`
- **THEN** the preview classifier SHALL NOT treat that account as a deposit-like owned account solely from the BIC value

### Requirement: Owned-account recognition spans all configured banks
The system SHALL treat an account as an owned account during Tochka transfer classification when its account number is mapped in the account mappings of ANY configured bank, not only the Tochka source bank.

#### Scenario: SBP transfer to own account in another bank is classified as transfer
- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record has `incoming = false`
- **AND** the record has `status = ACCEPTED`
- **AND** the payer account is an owned account mapped under the Tochka bank
- **AND** the payee account is an owned account mapped under a different configured bank
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record includes `counterpartyAccountId` equal to the payee account
- **AND** the Honey Money transfer record resolves `transfer_from_id` from the payer account and `transfer_to_id` from the payee account

#### Scenario: Account absent from every bank mapping is not owned
- **WHEN** a synchronized Tochka source record references an account
- **AND** that account number is not present in the account mappings of any configured bank
- **AND** that account is not a Tochka deposit-like account
- **THEN** the preview classifier SHALL NOT treat that account as an owned account

#### Scenario: Outgoing SBP payment to a third-party account stays an expense
- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record has `incoming = false`
- **AND** the payer account is an owned account
- **AND** the payee account is not present in the account mappings of any configured bank
- **THEN** the normalized record has `type = expense`

### Requirement: Incoming `SbpC2CPayment` from an owned account is classified as a save-ready transfer
The system SHALL classify an accepted incoming `SbpC2CPayment` whose payer account is owned in any configured bank as a save-ready transfer, resolving both legs through the cross-bank owned-account registry.

#### Scenario: Incoming SbpC2CPayment from my own account in another bank is a transfer
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2CPayment`
- **AND** the record has `status = DONE` and `incoming = true`
- **AND** the payer account is mapped in the account mappings of one of my configured banks (e.g. a Tinkoff debit account) and the payee account is one of my Tochka accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record carries `counterpartyAccountId` identifying the owned payer account
- **AND** the Honey Money transfer record resolves `transfer_from_id` from the payer account and `transfer_to_id` from the payee account

#### Scenario: Incoming SbpC2CPayment from a third-party account is not a transfer
- **WHEN** a synchronized Tochka source record has `type_code = SbpC2CPayment`
- **AND** the record has `status = DONE` and `incoming = true`
- **AND** the payer account is absent from every configured bank's account mappings
- **THEN** the normalized record does not have `type = transfer`
- **AND** the record is classified in the income flow

