## Why

Снятие наличных в банкомате (`CardTransactionInfo` + `tranCode = CashOutAtm`) сейчас не матчит ни `included`, ни `excluded` в `config/sources.json` и выпадает из обработки с `reason = "no matching included/excluded condition"` — в Honey Money не попадает ничего, а запись оседает в неопознанном шуме превью.

Простое добавление ветки в `included` дало бы неверную семантику: `getNormalizedType` жёстко возвращает `expense` для любой карточной записи кроме `ReverseByCard`. Но при снятии деньги не тратятся, а переезжают со счёта Точки на счёт «Кошелек», который зарегистрирован в Honey Money отдельным счётом (`id = 5695`, `rub`) и на котором наличные траты ведутся вручную. Классификация снятия расходом привела бы к двойному учёту: сначала 9000 ₽ как расход при снятии, потом те же деньги ещё раз как расходы по категориям при трате.

## What Changes

- `CardTransactionInfo` с `tranCode = CashOutAtm` и `status = Withdraw` попадает в `included` и классифицируется как save-ready **перевод** (`normalized.type = transfer`, `hmbee.subtype = 't'`), а не расход.
- Счёт-кошелёк добавляется в `config/sources.json` как псевдо-источник `cash` с синтетическим ключом счёта `cash:rub` → HM-счёт `5695`. Существующий резолвер `allAccountMappings` / `getHmAccountId` работает с ним без изменений — правки в `src/config.ts` и `createAccountRegistry` не требуются.
- Резолвинг ног перевода (`transfer_from_id` / `transfer_to_id`) обобщается: сейчас он инлайном читает `payerAccountId` / `payeeAccountId` и защищён guard'ом `isBankPaymentRecord`, из-за чего карточная запись до него не доходит. Вводится хелпер, отдающий пару `{ from, to }` по семейству записи.
- `counterpartyAccountId` для `CashOutAtm` выводится из валюты записи (`cash:${currency}`), а не из константы — второй кошелёк в другой валюте добавляется потом одним конфигом.
- Не BREAKING: поведение всех существующих сценариев (`Purchase`, `ReverseByCard`, SBP, RS-переводы, депозиты) не меняется.

Вне скоупа (осознанно отложено):

- внесение наличных в банкомате (обратное направление) — операция редкая, в синке не встречается;
- комиссия за снятие — снятия в пределах беcкомиссионного лимита;
- снятие через СБП в банкомате;
- `CashOutAtm` в статусе, отличном от `Withdraw` (например, холд `InProgress`), — остаётся `no matching included/excluded condition`.

## Capabilities

### New Capabilities

Новых capability не вводится.

### Modified Capabilities

- `tochka-transfer-preview`: добавляются требования (1) классифицировать `CashOutAtm + Withdraw` как save-ready перевод на счёт кошелька и (2) резолвить ноги перевода для записей, не являющихся банковскими платежами, — то есть когда встречная сторона не имеет номера банковского счёта.

## Impact

Затрагиваемый код и конфигурация:

- `config/sources.json` — новый источник `cash`, новая ветка `included` у `CardTransactionInfo`;
- `config/sources.example.json` — то же самое с обезличенными значениями;
- `src/apply/preview/tochka.ts` — `getNormalizedType`, `getCounterpartyAccount`, вынос резолвинга ног перевода из `normalizeTochkaRecord`;
- `src/apply/preview/fixtures/` — новая фикстура снятия;
- `src/apply/preview-CardTransactionInfo.test.ts` — кейсы на новый сценарий;
- `TRANSACTION-RULES.md` — строка сценария в таблице Точки.

Не затрагивается:

- `src/config.ts` и `createAccountRegistry` — схема принимает источник без `bankBic` и с пустыми `typeCodes`, формат ключа `accountMappings` не валидируется;
- синхронизация — ничто не итерирует `sources` для синка, команда `list` хардкодит `tochka`, поэтому источник `cash` инертен вне резолвинга HM-счёта;
- матчинг плановых транзакций — `subtype = 't'` уже поддержан, категория из ключа бакета для переводов исключается.

Риски:

- добавление `cash:rub` в `allAccountMappings` делает `isOwned('cash:rub', …)` истинным. Практического эффекта нет: ни одна банковская запись такой «номер счёта» не приносит, а формат синтетического ключа (`cash:` + валюта) не пересекается с номерами счетов РФ;
- рефакторинг резолвинга ног перевода трогает общий путь, по которому идут уже работающие сценарии (внутренние переводы, депозиты, SBP на свой счёт). Покрывается существующими тестами `preview-PaymentAccepted`, `preview-PaymentIncome`, `preview-PaymentWrittenOff`, `preview-SbpB2CPayment`, `preview-SbpC2CPayment` — они должны остаться зелёными без правок.

Нефункциональные требования:

- изменение не расширяет публичный API модуля превью — новый хелпер остаётся module-private;
- никаких магических строк в двух местах: синтетический ключ счёта формируется в одной функции, а сопоставление с HM-счётом живёт только в конфиге;
- сохраняется инвариант из `tochka-transfer-preview`: у каждой нормализованной transfer-записи заполнен `counterpartyAccountId`;
- реальный `id` HM-счёта попадает только в `config/sources.json` (файл в `.gitignore`); в `sources.example.json` и в тестах используются обезличенные значения (`1000004`). Документы самого изменения (proposal/design/tasks) реальный `id` называют — это описание сценария, а не конфигурация, и внутренний идентификатор счёта Honey Money секретом не является.

Валидация quality gates: `npm run check` (typecheck + Biome + vitest) должен проходить; новые кейсы добавляются в существующий per-type_code тест-файл, чтобы структура тестов осталась прежней.
