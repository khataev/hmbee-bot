## 1. Нормализация PaymentClaim в preview

- [x] 1.1 Добавить интерфейсы `PaymentClaimData` и `PaymentClaimRecord extends TochkaRecordMeta<'PaymentClaim'>` в `src/apply/preview/tochka.ts` (поля: `claimId`, `objectState`, `sum`, `currency`, `payerAccountId`, `payeeAccountId`, `purpose`, `direction`)
- [x] 1.2 Добавить `PaymentClaimRecord` в union `TochkaSyncRecord` и `type guard` `isPaymentClaimRecord`
- [x] 1.3 Добавить `'PaymentClaim'` в `SupportedTochkaTypeCode` и в `isSupportedTochkaTypeCode`
- [x] 1.4 Развести `PaymentClaim` по диспетчерам: `getTransactionId → claimId`, `getStatus → objectState`, `getAmount → sum`, `getSourceCurrency → currency`, `getSourceAccount → payerAccountId`, `getDescription → purpose`, `getMcc → undefined`
- [x] 1.5 Добавить в `getNormalizedType` ветку `PaymentClaim → 'expense'` (до transfer-детекции); НЕ добавлять `PaymentClaim` в `isBankPaymentRecord`, `getCounterpartyAccount` для неё возвращает `undefined`

## 2. Конфиг: правила типа и категории

- [x] 2.1 В `config/sources.json` добавить `sources.tochka.typeCodes.PaymentClaim` с `conditions.included = { "==": [{ "var": "record.data.objectState" }, "Processed"] }` и `conditions.excluded = { "or": [] }`
- [x] 2.2 В `config/sources.json` в двух правилах `hmbee.categoryMapping.rules` (СМС-информирование, лицензионное вознаграждение) заменить guard `type_code == "PaymentWrittenOff"` на `"PaymentClaim"`
- [x] 2.3 Синхронно повторить изменения 2.1 и 2.2 в `config/sources.example.json`

## 3. Тесты и фикстуры

- [ ] 3.1 Создать фикстуры `src/apply/preview/fixtures/payment-claim-sms.json` и `payment-claim-license.json` на основе примеров из `sync/tochka/2026-06-22_2026-07-06.json`
- [ ] 3.2 Создать `src/apply/preview-PaymentClaim.test.ts`: happy-path нормализация обеих фикстур в expense с `identified/save = true`, корректной категорией «Банки / Периодические списания» и `description` из `purpose`; кейс не-`Processed` статуса → `identified = false`
- [ ] 3.3 Обновить `src/apply/preview-category-rules.test.ts`: guard/фикстуры двух правил перевести с `PaymentWrittenOff` на `PaymentClaim`

## 4. Документация и проверка

- [ ] 4.1 Добавить в `TRANSACTION-RULES.md` строки для `PaymentClaim` (сценарий, `included`/`excluded`, ссылки на тест и фикстуры) и обновить упоминания перенесённых правил категории
- [ ] 4.2 Прогнать `npm run check` и весь набор `preview-*` тестов — всё зелёное
