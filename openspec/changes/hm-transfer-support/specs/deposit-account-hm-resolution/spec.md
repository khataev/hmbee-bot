# deposit-account-hm-resolution Specification

## ADDED Requirements

### Requirement: Deposit HoneyMoney accounts are declared in config with an explicit flag
The system SHALL allow `hmAccounts` entries to carry an optional `isDeposit: true` flag to mark them as the canonical HoneyMoney account representing all Tochka deposit accounts of the matching currency.

#### Scenario: Config loads successfully with a single deposit account per currency
- **WHEN** `hmAccounts` contains exactly one entry with `isDeposit: true` for a given currency
- **THEN** the config loads without error
- **AND** that entry is used as the deposit HM account for that currency

#### Scenario: Config load fails when two deposit accounts share a currency
- **WHEN** `hmAccounts` contains two or more entries with `isDeposit: true` for the same currency
- **THEN** config loading throws an error identifying the duplicate currency

#### Scenario: `hmAccounts` entries without `isDeposit` remain valid
- **WHEN** an `hmAccounts` entry does not include `isDeposit`
- **THEN** the entry is treated as a regular (non-deposit) account

### Requirement: HoneyMoney account ID for deposit accounts is resolved from the account number
The system SHALL resolve the HoneyMoney account ID for Tochka deposit-like accounts (`421*`) by extracting the ISO numeric currency code from the account number and looking up the matching deposit HM account.

#### Scenario: Deposit account resolves to HM account ID via currency code in account number
- **WHEN** `getHmAccountId` is called with a Tochka deposit-like account (`421*`)
- **AND** the account number contains a known ISO numeric currency code at positions 6–8
- **AND** a deposit HM account is configured for the corresponding HM currency
- **THEN** the HM account ID of the matching deposit account is returned

#### Scenario: Deposit account with unknown currency code returns undefined
- **WHEN** `getHmAccountId` is called with a Tochka deposit-like account (`421*`)
- **AND** the ISO numeric currency code extracted from the account number has no entry in `currenciesMapping`
- **THEN** `getHmAccountId` returns `undefined`

#### Scenario: Regular account resolution is unaffected
- **WHEN** `getHmAccountId` is called with an account present in `accountMappings`
- **THEN** the directly mapped HM account ID is returned without consulting deposit resolution

### Requirement: Currency code mapping from ISO numeric to HoneyMoney format is configurable
The system SHALL read a `hmbee.currenciesMapping` section from the application config that maps ISO-4217 numeric currency codes (as strings) to HoneyMoney currency code strings.

#### Scenario: Known ISO numeric code resolves to HM currency string
- **WHEN** `currenciesMapping` contains `{"810": "rub"}`
- **AND** a deposit account number has `810` at positions 6–8
- **THEN** the resolved HM currency is `"rub"`

#### Scenario: Application starts successfully without `hmbee` config section
- **WHEN** `sources.json` does not contain a `hmbee` key
- **THEN** the config loads with an empty `currenciesMapping`
- **AND** deposit account resolution returns `undefined` for all accounts
