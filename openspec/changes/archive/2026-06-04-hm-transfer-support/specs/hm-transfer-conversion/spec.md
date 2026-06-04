# hm-transfer-conversion Specification

## ADDED Requirements

### Requirement: Transfer records are converted to HoneyMoney transfer transactions
The system SHALL convert any Tochka record normalized as a transfer into a HoneyMoney transaction with `subtype: 't'`, linking both the source and destination HoneyMoney account IDs.

#### Scenario: Internal own-account transfer produces HM transfer transaction
- **WHEN** a Tochka preview record has `normalized.type = 'transfer'`
- **AND** the source account has a mapped HoneyMoney account ID
- **AND** the counterparty account has a resolvable HoneyMoney account ID
- **THEN** `hmbee.subtype` equals `'t'`
- **AND** `hmbee.account_id` equals the source HoneyMoney account ID
- **AND** `hmbee.transfer_from_id` equals the source HoneyMoney account ID
- **AND** `hmbee.transfer_to_id` equals the counterparty HoneyMoney account ID
- **AND** `hmbee.real_amount` is a positive value equal to the normalized amount
- **AND** `hmbee.transfer_to_amount` equals `hmbee.real_amount`

#### Scenario: Transfer to deposit account produces HM transfer transaction
- **WHEN** a Tochka preview record has `normalized.type = 'transfer'`
- **AND** the counterparty account is a Tochka deposit-like account (`421*`)
- **AND** a deposit HoneyMoney account is configured for the matching currency
- **THEN** `hmbee.subtype` equals `'t'`
- **AND** `hmbee.transfer_to_id` equals the deposit HoneyMoney account ID

#### Scenario: Transfer with unresolvable counterparty account yields unidentified record
- **WHEN** a Tochka preview record has `normalized.type = 'transfer'`
- **AND** the counterparty account has no resolvable HoneyMoney account ID
- **THEN** the preview record has `identified = false`
- **AND** the preview record has `save = false`

### Requirement: Non-transfer records retain income/expense subtype
The system SHALL continue to emit `subtype: 'e'` or `subtype: 'i'` for all records where `normalized.type` is not `'transfer'`.

#### Scenario: Expense record retains subtype 'e'
- **WHEN** a Tochka preview record has `normalized.type` that is not `'transfer'`
- **AND** the record represents an outgoing payment
- **THEN** `hmbee.subtype` equals `'e'`
- **AND** `hmbee.real_amount` is negative

#### Scenario: Income record retains subtype 'i'
- **WHEN** a Tochka preview record has `normalized.type` that is not `'transfer'`
- **AND** the record represents an incoming payment
- **THEN** `hmbee.subtype` equals `'i'`
- **AND** `hmbee.real_amount` is positive
