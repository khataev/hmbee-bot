## 1. Type wiring in `src/apply/preview/tochka.ts`

- [x] 1.1 Add `SbpC2CPaymentRecord extends TochkaRecordMeta<'SbpC2CPayment'>` with `data: SbpBaseTransactionData` (no payee-side extension — for an incoming payment `payeeName` is constant=me and `phoneNumber` is the sender's contact; neither is consumed by any accessor).
- [x] 1.2 Add `SbpC2CPaymentRecord` to the `SbpTransactionRecord` union, and add `'SbpC2CPayment'` to the `SbpTypeCode` and `SupportedTochkaTypeCode` unions.
- [x] 1.3 Add `'SbpC2CPayment'` to `isSupportedTochkaTypeCode` and `isSbpTransactionRecord`.
- [x] 1.4 Confirm (no code change expected) that `getSourceAccount`, `getCounterpartyAccount`, `getStatus`, `getAmount`, `getDescription`, `getSourceCurrency`, and `getNormalizedType` already cover the new record via the SBP branch.
- [x] 1.5 Run `npm run check` and fix any type/lint issues.

## 2. Classification rules in config

- [x] 2.1 Add `typeCodes.SbpC2CPayment` to `config/sources.json` with `included = { status == "DONE" AND incoming == true }` and `excluded = { incoming == false }` in JSON-logic form.
- [x] 2.2 Mirror the same `SbpC2CPayment` entry into `config/sources.example.json`.
- [x] 2.3 Run `npm run check`.

## 3. Tests

- [x] 3.1 Add fixtures under `src/apply/preview/fixtures/` derived from `sync/tochka/2026-03-31_2026-06-12.json` with masked PII: `sbp-c2c-payment-income.json` (DONE + incoming, external Сбербанк payer → income), `sbp-c2c-payment-own-transfer.json` (DONE + incoming, payer = my registered Tinkoff account `40817810900000136059` → transfer), plus negatives `sbp-c2c-payment-incoming-false.json` and `sbp-c2c-payment-unknown-status.json`.
- [x] 3.2 Add `src/apply/preview-SbpC2CPayment.test.ts` covering all four cases: (a) external-payer income (`identified/save = true`, income flow, `subtype = i`); (b) own-account transfer (`identified/save = true`, `normalized.type = transfer`, `counterpartyAccountId` = payer, HM `transfer_from_id`/`transfer_to_id` resolved cross-bank) consistent with `preview-SbpB2CPayment.test.ts` own-transfer case; (c) excluded outgoing (`save = false`, `reason = "excluded"`); (d) unknown status not identified. Use a test config whose registry maps both the Tochka payee and the Tinkoff payer account.
- [x] 3.3 Run `npm run check` and the test suite; ensure all pass.

## 4. Documentation

- [x] 4.1 Add `SbpC2CPayment` rows to the Точка table in `TRANSACTION-RULES.md`: income happy-path (external payer), own-account transfer (payer owned in another bank), and excluded outgoing form — with JSON-logic equivalents and test/fixture links.
- [x] 4.2 Final `npm run check` to confirm the Definition of Done gate passes.
