## 1. Документация правил

- [x] 1.1 В `TRANSACTION-RULES.md` разделить строку «SBP B2C невалидный статус или входящая форма» на «исходящая невалидная форма» (`CANCELED`/`REJECTED`, `incoming=false`) и добавить строку «перевод от своего счёта» для `incoming=true AND OWNED_PAYER`. Явно отметить, что incoming от не-owned плательщика не подпадает ни под `included`, ни под `excluded` (`identified=false`) — отдельная строка под этот случай не заводится, пока нет реального примера.
- [x] 1.2 В разделе «Что сейчас особенно важно помнить» обновить упоминание `SbpB2CPayment`, отразив, что owned-проверка для incoming-ветки сделана в JSON-logic (в отличие от `SbpC2CPayment`, где она делается в `getNormalizedType`), и что не-owned incoming сознательно оставлен неклассифицированным.

## 2. Конфигурация

- [x] 2.1 В `config/sources.json` добавить источник `raiffeisen`: `hmAccounts` с HM-счётом id `<см. config/raiffeisen-account.local.md>` ("Райффайзен ИП. РУБЛИ", currency `rub`) и `accountMappings: {"<см. config/raiffeisen-account.local.md>": "<ключ>"}`.
- [x] 2.2 В `config/sources.json` изменить `typeCodes.SbpB2CPayment.conditions`: `included` — добавить через `or` к существующей исходящей ветке новую ветку `incoming=true AND payerAccountId is owned` (owned-проверка через `is_owned`, тот же стиль, что и в исходящей ветке); `excluded` — оставить только `status in {CANCELED, REJECTED}`. Не-owned `incoming=true` сознательно не матчит ни одну ветку.
- [x] 2.3 Аналогично п. 2.1–2.2 обновить `config/sources.example.json` (источник `raiffeisen` с обезличенными тестовыми данными по аналогии с уже имеющимся `tinkoff`, те же изменения `included`/`excluded` для `SbpB2CPayment`).

## 3. Тесты

- [x] 3.1 Добавить новую фикстуру `src/apply/preview/fixtures/sbp-b2c-payment-own-transfer-incoming.json` (incoming=true, payer — owned тестовый счёт, payee — Точка), смоделированную по реальной транзакции, с обезличенными тестовыми account id/суммой в стиле существующих фикстур файла.
- [x] 3.2 В `src/apply/preview-SbpB2CPayment.test.ts` обновить локальный `typeCodeRules.SbpB2CPayment.conditions` в `options`, чтобы он соответствовал новому `included`/`excluded` из задачи 2.2.
- [x] 3.3 Убрать `sbp-b2c-payment-incoming.json` из списка фикстур теста "invalid forms" (excluded, `reason="excluded"`) и добавить отдельный тест: запись (payer не owned) даёт `identified=false, save=false, reason="no matching included/excluded condition"`.
- [x] 3.4 Добавить тест для новой фикстуры из 3.1: `identified=true, save=true, normalized.type=transfer`, `counterpartyAccountId` равен payer-счёту, `hmbee.subtype=t`, корректные `transfer_from_id`/`transfer_to_id`.
- [x] 3.5 Убедиться, что тест "invalid forms" по-прежнему проверяет `sbp-b2c-payment-canceled.json`/`sbp-b2c-payment-rejected.json` как excluded (без изменений в их ожиданиях).

## 4. Проверка

- [x] 4.1 Прогнать `npm run check` (typecheck + Biome lint) — без ошибок.
- [x] 4.2 Прогнать `npm run test` (vitest) — все тесты, включая обновлённые/новые в `preview-SbpB2CPayment.test.ts`, зелёные.
- [ ] 4.3 Прогнать `apply tochka --preview` на файле `sync/tochka/2026-07-24_2026-08-22.json` и убедиться, что реальная транзакция от 2026-08-15 теперь классифицируется как `identified=true, save=true, type=transfer` (промпт категории в `map:tochka` для неё по-прежнему может появляться — это отдельная задача, вне скоупа этого change).
