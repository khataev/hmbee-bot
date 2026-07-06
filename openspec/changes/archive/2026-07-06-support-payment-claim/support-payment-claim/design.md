## Context

RS-семейство Tochka preview-классификации (`src/apply/preview/tochka.ts`) построено на дискриминации по `type_code` через набор type guard'ов (`isPaymentWrittenOffRecord` и т.п.) и диспетчер-функций (`getTransactionId`, `getSourceAccount`, `getStatus`, `getAmount`, `getDescription`, `getSourceCurrency`, `getNormalizedType`, `getCounterpartyAccount`, `getMcc`). Каждый новый тип добавляется единообразно: интерфейс `*Data`/`*Record`, guard, ветка в `isSupportedTochkaTypeCode` и по ветке в каждом диспетчере.

Точка перенесла периодические списания (СМС-информирование, лицензионное вознаграждение) с `PaymentWrittenOff` на новый `PaymentClaim`. Пример полей — `sync/tochka/2026-06-22_2026-07-06.json` (2 записи). `PaymentClaim` структурно близок к RS-типам, но имеет отличия: нет `corebankingId`/`incoming`/`payerBankBic`/`payeeBankBic`; `title = "No title"`, смысловой текст в `purpose`; направление в `direction: "IN"`.

## Goals / Non-Goals

**Goals:**
- Поддержать `type_code = PaymentClaim` в preview-классификации как всегда-expense income/expense-запись.
- Перенести существующие правила категории двух периодических списаний на новый `type_code` без изменения категорий и совпадений по `purpose`.
- Сохранить единообразие с остальными RS-типами и зелёный `npm run check` + `preview-*` тесты.

**Non-Goals:**
- Изменение адаптера `src/adapters/tochka.ts` (фильтр уже добавлен ранее).
- Поддержка `PaymentClaim` как income/transfer или обработка нестандартных `objectState`/`direction` (нет примеров; при появлении — отдельная change).
- Обработка возвратов/сторно `PaymentClaim`.

## Decisions

- **`transactionId = data.claimId`.** У `PaymentClaim` нет `corebankingId`. `claimId` — семантический идентификатор претензии, уникальный и стабильный; используется для дедупликации наравне с `corebankingId`/`tranId` других типов.
- **`description = data.purpose`, а не `data.title`.** У `PaymentClaim` `title = "No title"`; читаемый текст лежит в `purpose`. Диспетчер `getDescription` получает специальную ветку для `PaymentClaim`, возвращающую `purpose` (у остальных RS-типов остаётся `title`). Это же поле уже используется правилами категории, поэтому HM-описание и резолюция категории согласованы.
- **Всегда `expense`; `direction` игнорируется.** Плательщик — мой счёт (`payerAccountId`), получатель — внешняя Точка. `getNormalizedType` получает ветку `PaymentClaim → 'expense'` до общей transfer-детекции.
- **Не bank payment record.** `PaymentClaim` НЕ добавляется в `isBankPaymentRecord`, потому что у неё нет `payerBankBic`/`payeeBankBic`, на которые опирается `is_owned`/transfer-логика. Как следствие `getCounterpartyAccount` для неё возвращает `undefined` — для expense это корректно.
- **`included = objectState == "Processed"`, `excluded = { "or": [] }`.** Минимальный предикат, совпадающий с имеющимися примерами; повторяет форму других RS-типов, где статус берётся из `objectState`. Иные статусы дают «no matching included/excluded condition».
- **Правила категории переносятся, не дублируются.** В `hmbee.categoryMapping.rules` у двух правил (СМС-информирование, лицензионное вознаграждение) guard `type_code == "PaymentWrittenOff"` заменяется на `"PaymentClaim"`. Историческая обработка `PaymentWrittenOff` для этих двух списаний более не требуется (Точка перевела их на новый тип).
- **Синхронность конфигов.** `config/sources.json` и `config/sources.example.json` меняются вместе (typeCodes + rules), согласно дисциплине из `TRANSACTION-RULES.md`.

## Risks / Trade-offs

- **Выбор `claimId` как id.** Если Точка присылает несколько частичных списаний по одной претензии (`hasPartials = true`/`partial = true`), `claimId` может быть неуникален. В примерах `hasPartials = false`; риск отмечен, при появлении partials потребуется составной id (`claimId + documentNumber`).
- **Игнорирование `direction`.** Если появится `PaymentClaim` с реальным income/возвратом, текущая логика ошибочно классифицирует его как expense. Митигируется тем, что `included` ограничен `Processed` и семантикой «claim = списание»; при обнаружении обратного — отдельная доработка.
- **Потеря обработки старых `PaymentWrittenOff`-списаний.** Перенос guard'а означает, что исторические записи этих двух списаний под `PaymentWrittenOff` больше не попадут в категорию. Приемлемо: Точка перевела поток на `PaymentClaim`, повторная классификация старых периодов не планируется.
