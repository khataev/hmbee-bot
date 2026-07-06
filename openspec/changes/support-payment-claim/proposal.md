## Why

Точка перенесла периодические банковские списания (СМС-информирование и оплата лицензионного вознаграждения) с `type_code` `PaymentWrittenOff` на новый `type_code` `PaymentClaim`. Адаптер уже возвращает эти записи, но preview-классификатор их не поддерживает — они падают в `unsupported type_code`, а действующие правила категории всё ещё привязаны к старому `PaymentWrittenOff` и на новые записи не срабатывают.

## What Changes

- Добавить `PaymentClaim` в список поддерживаемых `type_code` Tochka preview-классификации: новая форма записи `PaymentClaimData`/`PaymentClaimRecord`, type guard и разводка во всех `getX`-диспетчерах нормализации.
- `PaymentClaim` нормализуется всегда как **expense**: поле `direction: "IN"` игнорируется (плательщик — мой счёт), запись не участвует в transfer-детекции (у неё нет `payerBankBic`/`payeeBankBic`), поэтому в `isBankPaymentRecord` она НЕ добавляется.
- Специфика полей `PaymentClaim` относительно других RS-типов: `transactionId = claimId`, `description = purpose` (у `PaymentClaim` `title = "No title"`, тогда как остальные RS-типы используют `title`), статус берётся из `objectState`.
- `included`-условие для сохранения — `objectState == "Processed"`; `excluded` — пустой.
- Перевести два существующих правила категории (СМС-информирование, лицензионное вознаграждение) с guard `type_code == "PaymentWrittenOff"` на `type_code == "PaymentClaim"` — без дубликатов, категория и совпадение по `purpose` сохраняются.
- Синхронно обновить `config/sources.json` и `config/sources.example.json`, покрыть новый тип фокусными тестами и фикстурами, актуализировать `TRANSACTION-RULES.md`.

Quality gates: `npm run check` (Biome lint+format, TypeScript strict) и весь набор `preview-*` тестов должны проходить; для нового `type_code` добавляется отдельный `preview-PaymentClaim.test.ts` с фикстурами happy-path (СМС и лицензия).

## Capabilities

### New Capabilities
- `tochka-payment-claim-preview`: правила нормализации и классификации Tochka-записей `type_code = PaymentClaim` (маппинг полей `claimId`/`purpose`/`objectState`, всегда-expense, отсутствие transfer-детекции, `included = objectState Processed`).

### Modified Capabilities
- `tochka-category-mapping`: два правила периодических списаний (СМС-информирование, лицензионное вознаграждение) переходят с guard `type_code == "PaymentWrittenOff"` на `type_code == "PaymentClaim"`.

## Impact

- Код: `src/apply/preview/tochka.ts` (новая форма записи, type guard, диспетчеры `getTransactionId`/`getSourceAccount`/`getStatus`/`getAmount`/`getDescription`/`getSourceCurrency`/`getNormalizedType` и др.).
- Конфиг: `config/sources.json`, `config/sources.example.json` (`sources.tochka.typeCodes.PaymentClaim`, два правила в `hmbee.categoryMapping.rules`).
- Тесты/фикстуры: новый `src/apply/preview-PaymentClaim.test.ts`, фикстуры `payment-claim-sms.json` и `payment-claim-license.json`, обновление `src/apply/preview-category-rules.test.ts`.
- Документация: `TRANSACTION-RULES.md` (строки по `PaymentClaim`).
- Адаптер `src/adapters/tochka.ts` — фильтр уже добавлен (вне рамок этой change, изменение уже присутствует в рабочем дереве).
