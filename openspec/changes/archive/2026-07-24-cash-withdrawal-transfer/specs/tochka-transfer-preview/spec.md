# tochka-transfer-preview (delta)

## ADDED Requirements

### Requirement: ATM cash withdrawal is classified as a save-ready transfer to the cash wallet
The system SHALL classify a settled Tochka ATM cash withdrawal as a save-ready transfer from the card account to the configured cash wallet account, and SHALL NOT classify it as an expense.

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

#### Scenario: Settled `CashOutAtm` card transaction is never normalized as an expense
- **WHEN** a synchronized Tochka source record has `type_code = CardTransactionInfo`
- **AND** the record has `tranCode = CashOutAtm`
- **AND** the record has `status = Withdraw`
- **THEN** the normalized record SHALL NOT have `type = expense`
- **AND** the Honey Money record has `subtype = t`

#### Scenario: `CashOutAtm` card transaction in any other status is not identified
- **WHEN** a synchronized Tochka source record has `type_code = CardTransactionInfo`
- **AND** the record has `tranCode = CashOutAtm`
- **AND** the record has a `status` other than `Withdraw`
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

### Requirement: Transfer leg resolution supports counterparties without a bank account number
The system SHALL resolve the paying and receiving Honey Money accounts of a normalized transfer from the source record family, rather than requiring every transfer record to be a bank payment record carrying `payerAccountId` and `payeeAccountId`.

#### Scenario: Card-family transfer resolves both legs without a bank payment record
- **WHEN** a save-ready transfer originates from a `CardTransactionInfo` record
- **THEN** the system SHALL resolve `transfer_from_id` from the account the card is issued against
- **AND** SHALL resolve `transfer_to_id` from `counterpartyAccountId`
- **AND** SHALL NOT reject the record on the grounds that it is not a bank payment record

#### Scenario: Bank payment transfers keep resolving legs from payer and payee
- **WHEN** a save-ready transfer originates from a bank payment record
- **THEN** the system SHALL resolve `transfer_from_id` from the payer account
- **AND** SHALL resolve `transfer_to_id` from the payee account
- **AND** this resolution SHALL be independent of whether the source record is the incoming or the outgoing leg

#### Scenario: Transfer whose leg cannot be resolved to a Honey Money account is reported, not saved
- **WHEN** a synchronized Tochka source record is classified as a transfer
- **AND** either transfer leg cannot be resolved to a configured Honey Money account
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record has a `reason` naming the unresolved transfer leg

### Requirement: Cash wallet accounts are resolved through account mappings configuration
The system SHALL resolve the cash wallet Honey Money account through the existing cross-bank account mappings configuration, keyed by a synthetic cash account identifier derived from the transaction currency, so that adding a cash wallet for a further currency requires configuration only.

#### Scenario: Cash wallet account is looked up by synthetic currency-derived identifier
- **WHEN** the preview classifier resolves the cash wallet counterparty for a record in currency `RUB`
- **THEN** the system SHALL derive the synthetic account identifier `cash:rub`
- **AND** SHALL look that identifier up in the account mappings of all configured sources
- **AND** SHALL use the mapped Honey Money account id as `transfer_to_id`

#### Scenario: Cash wallet for an additional currency requires no code change
- **WHEN** a cash wallet account for a currency other than `RUB` is added to the account mappings configuration
- **THEN** a settled `CashOutAtm` record in that currency SHALL resolve to that cash wallet account
- **AND** no change to the preview classifier SHALL be required

#### Scenario: Cash withdrawal in a currency without a configured wallet is not saved
- **WHEN** a synchronized Tochka source record has `type_code = CardTransactionInfo`
- **AND** the record has `tranCode = CashOutAtm` and `status = Withdraw`
- **AND** no cash wallet account is configured for the record currency
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`
- **AND** the preview record has a `reason` naming the unresolved transfer leg
