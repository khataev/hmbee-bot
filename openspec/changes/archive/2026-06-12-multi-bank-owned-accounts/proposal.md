## Why

Транзакции `SbpB2CPayment` между собственными счетами в разных банках (например, перевод Точка → Т-Банк) ошибочно классифицируются как `expense` вместо `transfer`. Причина: `config/sources.json` описывает счета нескольких банков (`tochka`, `sber`, `tinkoff`), но схема конфига, загрузчик и реестр счетов учитывают только `tochka`. Поэтому счёт-контрагент в другом банке не распознаётся как «мой», и перевод между своими счетами выглядит как обычный расход.

## What Changes

- Схема конфига перестаёт ограничивать `sources` единственным банком `tochka` и принимает произвольный набор банков (`tochka`, `sber`, `tinkoff`, …), каждый со своими `hmAccounts` и `accountMappings`.
- `loadConfig` резолвит `accountMappings` каждого банка против `hmAccounts` того же банка и строит объединённую карту `accountNumber → honeyMoneyAccountId` по всем банкам.
- `createAccountRegistry` строит реестр над объединённой картой: `isOwned` и `getHmAccountId` распознают счета всех настроенных банков, а не только Точки.
- Депозитная эвристика (`isDeposit`, `421*` + BIC Точки) остаётся частной историей Точки и не расширяется.
- Появляется защита от коллизий: один и тот же номер счёта не может встречаться в маппингах двух банков с разными Honey Money id.
- **BREAKING** для конфигурации: внутреннее устройство resolved-конфига меняется (per-bank → объединённые карты). Формат `config/sources.json` обратно совместим — раньше блоки `sber`/`tinkoff` молча игнорировались, теперь учитываются.

## Capabilities

### New Capabilities

(нет новых capability — изменяется поведение существующих)

### Modified Capabilities

- `tochka-transfer-preview`: понятие «owned account» при классификации перевода расширяется с «счёт Точки» до «счёт любого настроенного банка». Сценарий собственного внешнего SBP-перевода (`SbpB2CPayment`, payer owned, payee owned) теперь срабатывает и когда payee — счёт в другом банке.
- `secure-config-management`: маппинги «банковский счёт → Honey Money» загружаются из локального конфига для всех настроенных банков, а не только для Точки.

## Impact

- Код: [src/config.ts](src/config.ts) — схема `AppConfigSchema`/`ResolvedAppConfigSchema`, `loadConfig`, `createAccountRegistry`.
- Поведение классификатора: [src/apply/preview/tochka.ts](src/apply/preview/tochka.ts) `getNormalizedType` и transfer-ветка `normalizeTochkaRecord` начинают распознавать кросс-банковские переводы (изменений в самом файле может не потребоваться — он опирается на реестр).
- Конфиг: [config/sources.json](config/sources.json) и его пример начинают реально использовать блоки `sber`/`tinkoff`.
- Тесты: существующие preview-тесты (`OWNED_PAYER`/`OWNED_PAYEE` в правилах `PaymentIncome`/`PaymentAccepted`) — проверить отсутствие регрессий; добавить покрытие кросс-банковского SBP-перевода.
- Документация: [TRANSACTION-RULES.md](TRANSACTION-RULES.md) — уточнить, что «общий список моих счетов» охватывает все банки.

## Quality Gates

- `npm run check` (Biome lint+format + TypeScript strict) проходит.
- Все существующие `src/apply/preview-*.test.ts` зелёные (нет регрессий по классификации).
- Новый тест воспроизводит исходный баг: `SbpB2CPayment` Точка → Т-Банк даёт `normalized.type = transfer` с заполненным `counterpartyAccountId` и корректными `transfer_from_id`/`transfer_to_id`.
