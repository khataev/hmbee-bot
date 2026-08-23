## MODIFIED Requirements

### Requirement: ATM cash withdrawal is classified as a save-ready transfer to the cash wallet
The system SHALL classify a Tochka ATM cash withdrawal in status `Withdraw` or `InProgress` as a save-ready transfer from the card account to the configured cash wallet account, and SHALL NOT classify it as an expense.

#### Scenario: Settled `CashOutAtm` card transaction is a transfer to the cash wallet
- **WHEN** a synchronized Tochka source record has `type_code = CardTransactionInfo`
- **AND** the record has `tranCode = CashOutAtm`
- **AND** the record has `status = Withdraw`
- **AND** the card account is an owned account
- **AND** a cash wallet account is configured for the record currency
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record includes `counterpartyAccountId` identifying the cash wallet account for the record currency
- **AND** the Honey Money transfer record resolves `transfer_from_id` from the card account and `transfer_to_id` from the cash wallet account

#### Scenario: `CashOutAtm` card transaction on hold is also a transfer to the cash wallet
- **WHEN** a synchronized Tochka source record has `type_code = CardTransactionInfo`
- **AND** the record has `tranCode = CashOutAtm`
- **AND** the record has `status = InProgress`
- **AND** the card account is an owned account
- **AND** a cash wallet account is configured for the record currency
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = true`
- **AND** the preview record has `reason = null`
- **AND** the normalized record has `type = transfer`
- **AND** the normalized record includes `counterpartyAccountId` identifying the cash wallet account for the record currency
- **AND** the Honey Money transfer record resolves `transfer_from_id` from the card account and `transfer_to_id` from the cash wallet account

#### Scenario: Settled `CashOutAtm` card transaction is never normalized as an expense
- **WHEN** a synchronized Tochka source record has `type_code = CardTransactionInfo`
- **AND** the record has `tranCode = CashOutAtm`
- **AND** the record has `status = Withdraw` or `status = InProgress`
- **THEN** the normalized record SHALL NOT have `type = expense`
- **AND** the Honey Money record has `subtype = t`

#### Scenario: `CashOutAtm` card transaction in any other status is not identified
- **WHEN** a synchronized Tochka source record has `type_code = CardTransactionInfo`
- **AND** the record has `tranCode = CashOutAtm`
- **AND** the record has a `status` other than `Withdraw` or `InProgress`
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "no matching included/excluded condition"`

#### Scenario: Cash withdrawal transfer requires no category
- **WHEN** a synchronized Tochka source record is identified as a save-ready cash withdrawal transfer
- **THEN** the Honey Money transfer record has `category = null`
- **AND** the record remains `save = true`
- **AND** the missing-category downgrade SHALL NOT apply to it

#### Scenario: Cash withdrawal produces exactly one save-ready record
- **WHEN** a synchronized Tochka source record is identified as a save-ready cash withdrawal transfer
- **THEN** no mirrored leg of the same withdrawal is expected in the same synchronized source file
- **AND** no additional exclusion branch is required to suppress a duplicate leg
