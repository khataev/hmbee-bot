## Why

Реальная синхронизированная транзакция — входящий `SbpB2CPayment` перевод с моего ИП-счёта в Райффайзене на мой ИП-счёт в Точке (event_date 2026-08-15) — сейчас безусловно попадает в `excluded` в `config/sources.json`, потому что текущее правило исключает **любую** запись `SbpB2CPayment` с `incoming = true`, независимо от того, кому принадлежит счёт плательщика. В результате запись не сохраняется в Honey Money, хотя по сути является переводом между собственными счетами, а не потерянными данными.

## What Changes

- Зарегистрировать счёт «Райффайзен ИП. РУБЛИ» (`<см. config/raiffeisen-account.local.md>`) как owned-счёт в `config/sources.json` и `config/sources.example.json` — новый источник `raiffeisen` с соответствующим `hmAccounts`/`accountMappings` (по аналогии с уже описанным в `sources.example.json` `tinkoff`).
- Изменить `included`/`excluded` условия для `SbpB2CPayment` в `config/sources.json` и `config/sources.example.json`: добавить в `included` отдельную ветку `incoming=true AND payerAccountId is owned` (наравне с существующей исходящей веткой `incoming=false AND OWNED_PAYER` — тот же стиль owned-проверки в JSON-logic, уже используемый этим type_code), и сузить `excluded` до `status in {CANCELED, REJECTED}`. Входящий платёж от НЕ owned плательщика намеренно не матчит ни `included`, ни `excluded` и остаётся `identified = false` — решение по нему откладывается до появления реального примера.
- Обновить `TRANSACTION-RULES.md`: разделить строку «SBP B2C невалидный статус или входящая форма» на «исходящая невалидная форма» (`CANCELED`/`REJECTED`) и добавить строку про входящий перевод от owned-счёта.
- Обновить тесты `src/apply/preview-SbpB2CPayment.test.ts`: заменить ожидание для `sbp-b2c-payment-incoming.json` (payer не owned) — было `excluded`, станет отдельный тест на `identified = false, reason = "no matching included/excluded condition"`; добавить новую фикстуру на основе реальной транзакции для сценария «входящий перевод от owned-счёта» (`identified = true, save = true, type = transfer`).

Гипотетический сценарий «входящий B2C от постороннего юрлица» намеренно оставлен неклассифицированным (`identified = false`), а не отнесён к income или excluded — реальных примеров такой формы в синках пока не было, и решать его судьбу сейчас преждевременно.

## Capabilities

### New Capabilities
(нет)

### Modified Capabilities
- `tochka-transfer-preview`: добавляется требование о классификации входящего `SbpB2CPayment` от owned-счёта как save-ready transfer через отдельную owned-ветку в `included` (не через безусловный пропуск всего `incoming=true`, как у `SbpC2CPayment`); не-owned входящий `SbpB2CPayment` остаётся `identified = false`, а не переходит в income или excluded.

## Impact

- `config/sources.json`, `config/sources.example.json` — новый источник `raiffeisen`, изменённые `included`/`excluded` для `SbpB2CPayment`.
- `TRANSACTION-RULES.md` — обновление таблицы сценариев для `SbpB2CPayment`.
- `src/apply/preview-SbpB2CPayment.test.ts`, `src/apply/preview/fixtures/` — обновлённый и новый фикстуры/тесты.
- Обратная совместимость: расширяется только owned-ветка `included`; поведение для не-owned входящих платежей меняется с `excluded` (`identified=true, save=false, reason="excluded"`) на `identified=false, reason="no matching included/excluded condition"` — оба случая не сохраняются в Honey Money, меняется только `reason`/`identified` в превью. Исторические уже дропнутые записи не пересчитываются автоматически.
- Качество: изменения покрываются `npm run check` (typecheck + lint) и `npm run test` (vitest) — оба должны проходить перед завершением change; новые фикстуры и кейсы добавляются в существующий тестовый файл без новых зависимостей.
