## ADDED Requirements

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
