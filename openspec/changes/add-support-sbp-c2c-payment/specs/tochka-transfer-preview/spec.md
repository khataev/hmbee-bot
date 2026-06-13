## ADDED Requirements

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
