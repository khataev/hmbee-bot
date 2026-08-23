## ADDED Requirements

### Requirement: Incoming `SbpB2CPayment` from an owned account is classified as a save-ready transfer

The system SHALL classify an accepted incoming `SbpB2CPayment` whose payer account is owned in any configured bank as a save-ready transfer, resolving both legs through the cross-bank owned-account registry. Unlike incoming `SbpC2CPayment`, an incoming `SbpB2CPayment` whose payer account is not owned SHALL NOT be classified at all (no income fallback) until a dedicated rule for that scenario is introduced.

#### Scenario: Incoming SbpB2CPayment from my own account in another bank is a transfer

- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record has `status = ACCEPTED` and `incoming = true`
- **AND** the payer account is mapped in the account mappings of one of my configured banks (e.g. my Raiffeisen ИП account) and the payee account is one of my Tochka accounts
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record carries `counterpartyAccountId` identifying the owned payer account
- **AND** the Honey Money transfer record resolves `transfer_from_id` from the payer account and `transfer_to_id` from the payee account

#### Scenario: Incoming SbpB2CPayment from a third-party account is not classified

- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record has `status = ACCEPTED` and `incoming = true`
- **AND** the payer account is absent from every configured bank's account mappings
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "no matching included/excluded condition"`

#### Scenario: Canceled or rejected incoming SbpB2CPayment is still excluded

- **WHEN** a synchronized Tochka source record has `type_code = SbpB2CPayment`
- **AND** the record has `incoming = true`
- **AND** the record has `status = CANCELED` or `status = REJECTED`
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "excluded"`
