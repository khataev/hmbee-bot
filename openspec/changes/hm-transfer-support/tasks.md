## 1. Config Schema — `hmbee` section and `isDeposit` flag

- [ ] 1.1 Add `hmbee.currenciesMapping` top-level key to `AppConfigSchema` and `ResolvedAppConfigSchema` in `config.ts` (optional, defaults to `{}`)
- [ ] 1.2 Add `isDeposit?: boolean` field to `HoneyMoneyAccountSchema` in `config.ts`
- [ ] 1.3 Add config-load validation: error if any currency has more than one `hmAccounts` entry with `isDeposit: true`
- [ ] 1.4 Update `sources.example.json`: add `hmbee.currenciesMapping` section (`810→rub`, `840→usd`, `978→eur`) and set `isDeposit: true` on `tochka-ip-deposits`
- [ ] 1.5 Sync `sources.json` structure to match `sources.example.json` (add `hmbee` section and `isDeposit` where applicable)
- [ ] 1.6 Run `npm run check` — confirm config schema changes type-check and lint cleanly

## 2. AccountRegistry — deposit HM account resolution

- [ ] 2.1 In `createAccountRegistry`, build a `depositByCurrency` map at init time from `hmAccounts` entries where `isDeposit === true`
- [ ] 2.2 Update `getHmAccountId(account)`: after direct-mapping miss, if `isDeposit(account)` → extract `account.slice(5, 8)` → look up in `currenciesMapping` → look up in `depositByCurrency` → return ID or `undefined`
- [ ] 2.3 Run `npm run check`

## 3. `HoneyMoneyTransaction` type — discriminated union

- [ ] 3.1 In `types.ts`, split `HoneyMoneyTransaction` into `HoneyMoneyIncomeExpenseTransaction` (`subtype: 'e' | 'i'`) and `HoneyMoneyTransferTransaction` (`subtype: 't'`, `transfer_from_id: number`, `transfer_to_id: number`, `transfer_to_amount: number`, `real_amount: number`)
- [ ] 3.2 Re-export `HoneyMoneyTransaction` as the union of both types
- [ ] 3.3 Run `npm run check` — fix any type errors caused by the union change in `tochka.ts` or `client.ts`

## 4. Normalization — transfer branch in `buildHoneyMoneyTransaction`

- [ ] 4.1 In `normalizeTochkaRecord` (`tochka.ts`), resolve `counterpartyHmId = registry.getHmAccountId(normalized.counterpartyAccountId)` before calling `buildHoneyMoneyTransaction`
- [ ] 4.2 If `normalized.type === 'transfer'` and `counterpartyHmId` is `undefined`, throw an error (will surface as `identified: false` via existing catch)
- [ ] 4.3 Pass `counterpartyHmId` to `buildHoneyMoneyTransaction` (add parameter; only required when type is transfer)
- [ ] 4.4 Add transfer branch in `buildHoneyMoneyTransaction`: when `normalized.type === 'transfer'`, return `HoneyMoneyTransferTransaction` with `subtype: 't'`, positive `real_amount`, `transfer_from_id = accountId`, `transfer_to_id = counterpartyHmId`, `transfer_to_amount = real_amount`
- [ ] 4.5 Run `npm run check`

## 5. Tests — update existing and add new

- [ ] 5.1 In `preview-PaymentAccepted.test.ts`: update internal transfer test — change `hmbee.subtype` assertion from `'e'` to `'t'`, add `hmbee.transfer_from_id` and `hmbee.transfer_to_id` assertions, verify `real_amount` is positive
- [ ] 5.2 In `preview-PaymentWrittenOff.test.ts`: update deposit transfer test — change `hmbee.subtype` from `'e'` to `'t'`, update `real_amount` assertion to positive value, add `transfer_from_id`/`transfer_to_id` assertions
- [ ] 5.3 Add `tochka-ip-deposits` mapping to the test `options` fixture in both test files so `getHmAccountId` resolves the deposit counterparty
- [ ] 5.4 Add `hmbee.currenciesMapping` to test options where needed for deposit resolution
- [ ] 5.5 Run `npm run check` — all tests must pass
