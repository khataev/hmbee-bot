## MODIFIED Requirements

### Requirement: Tochka preview classifies supported transfer records with canonical save behavior
The system SHALL classify supported Tochka transfer records so that one canonical record remains save-ready for each supported transfer scenario and only mirrored duplicate legs reported by the same source bank are excluded.

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
- **AND** the payer account belongs to the Tochka bank specifically (the payer bank BIC equals the Tochka BIC)
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

## ADDED Requirements

### Requirement: Incoming `PaymentIncome` from an owned account in another bank is classified as a save-ready transfer
The system SHALL classify an incoming `PaymentIncome` record whose payer account is owned in a configured bank OTHER than Tochka as a save-ready transfer, resolving both legs through the cross-bank owned-account registry. This applies precisely because no other synchronized source reports the outgoing leg of such a transfer, so the incoming Tochka leg is the only available signal and MUST NOT be excluded as a presumed duplicate.

#### Scenario: Incoming PaymentIncome from my own account in another bank is a transfer
- **WHEN** a synchronized Tochka source record has `type_code = PaymentIncome`
- **AND** the record has `incoming = true`
- **AND** the record has `isComission = false`
- **AND** the payer account is mapped in the account mappings of one of my configured banks other than Tochka (e.g. my Raiffeisen ИП account) and the payee account is one of my Tochka accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record carries `counterpartyAccountId` identifying the owned payer account
- **AND** the Honey Money transfer record resolves `transfer_from_id` from the payer account and `transfer_to_id` from the payee account
