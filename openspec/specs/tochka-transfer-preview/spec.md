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

