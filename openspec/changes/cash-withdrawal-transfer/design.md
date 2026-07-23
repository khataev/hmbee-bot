## Context

Превью-классификатор Точки (`src/apply/preview/tochka.ts`) сейчас различает три нормализованных типа: `income`, `expense`, `transfer`. Тип определяется в `getNormalizedType`, и карточные записи выходят из неё первой же веткой:

```ts
if (isCardTransactionInfoRecord(sourceRecord)) {
  return sourceRecord.data.tranCode === 'ReverseByCard' ? 'income' : 'expense';
}
```

Transfer-детекция стоит ниже и требует `isBankPaymentRecord` — то есть SBP- или RS-запись с полями `payerAccountId` / `payeeAccountId` / `payerBankBic` / `payeeBankBic`. Карточная запись до неё не доходит в принципе.

Ниже, в `normalizeTochkaRecord`, ветка перевода резолвит HM-счета инлайном:

```ts
if (!isBankPaymentRecord(sourceRecord)) throw new Error('Transfer must be a bank payment record');
const payerHmId = options.accountRegistry.getHmAccountId(sourceRecord.data.payerAccountId);
const payeeHmId = options.accountRegistry.getHmAccountId(sourceRecord.data.payeeAccountId);
```

Итого на пути «снятие наличных → перевод» четыре препятствия: тип захардкожен, `getCounterpartyAccount` для карточных записей возвращает `undefined` (а инвариант требует непустой `counterpartyAccountId`), guard отсекает не-банковские записи, и резолвинг ног читает поля, которых у карточной записи нет.

Фактические данные сценария (единственный экземпляр в синке за 2026-07-09…2026-07-23):

```json
{ "type_code": "CardTransactionInfo",
  "tranCode": "CashOutAtm", "status": "Withdraw", "mcc": "6011",
  "title": "Снятие наличных в банкомате",
  "sum": 9000, "currency": "RUB", "incoming": false,
  "account": "40802810309500023530", "bic": "044525104" }
```

Зеркальной ноги у записи нет — в отличие от внутренних переводов и депозитов, дедуплицировать нечего. Счёт «Кошелек» уже существует в Honey Money (`id = 5695`, `currency = rub`), баланс на нём совпадает с суммой этого снятия.

## Goals / Non-Goals

**Goals:**

- Классифицировать `CashOutAtm + Withdraw` как save-ready перевод `Точка ИП. РУБЛИ → Кошелек`.
- Сделать это, не меняя `src/config.ts` и `createAccountRegistry`.
- Обобщить резолвинг ног перевода так, чтобы встречная сторона могла не быть банковским счётом, сохранив поведение всех существующих transfer-сценариев.
- Оставить расширение на второй кошелёк (другая валюта) чисто конфигурационным.

**Non-Goals:**

- Внесение наличных через банкомат (обратное направление).
- Комиссия за снятие сверх лимита.
- Снятие наличных через СБП.
- `CashOutAtm` в статусе холда (`InProgress`) — сознательно не включается, хотя для `Purchase` оба статуса в `included`.
- Автоматический учёт трат наличными — они по-прежнему заводятся в Honey Money вручную на счёте кошелька.

## Decisions

### Решение 1: кошелёк объявляется псевдо-источником `cash` с синтетическим ключом счёта

```json
"cash": {
  "hmAccounts": {
    "cash-wallet-rub": { "id": 5695, "name": "Кошелек", "currency": "rub" }
  },
  "accountMappings": { "cash:rub": "cash-wallet-rub" }
}
```

`BankConfigSchema` принимает это без изменений: `bankBic` объявлен optional, `hmAccounts` / `accountMappings` / `typeCodes` имеют дефолты, а формат ключа `accountMappings` — просто `z.record(z.string(), z.string())`, никакой валидации номера счёта нет. `loadConfig` положит `cash:rub → 5695` в `allAccountMappings`, и `getHmAccountId('cash:rub')` заработает сам собой.

**Альтернативы:**

- *Новая секция `hmbee.virtualAccounts` + отдельный резолвер.* Семантически честнее — кошелёк действительно не «источник», из него ничего не синхронизируется. Отвергнуто: ради одного счёта появляется второй механизм сопоставления HM-счетов, который придётся поддерживать параллельно с `allAccountMappings` и учитывать во всех местах, где сейчас достаточно `getHmAccountId`. Цена выше пользы.
- *Флаг `isCash: true` в `HoneyMoneyAccountSchema` + `getCashAccountId(currency)` в реестре, по образцу `isDeposit` / `depositByCurrency`.* Отвергнуто: инвариант `tochka-transfer-preview` требует непустой `counterpartyAccountId`, то есть строковый идентификатор счёта нужен всё равно; при этом варианте пришлось бы и синтетический идентификатор придумать, и схему с реестром расширить. Синтетический ключ решает обе задачи один.
- *Положить кошелёк в `sources.tochka.hmAccounts`.* Отвергнуто: кошелёк не имеет отношения к Точке, а `sources.tochka` дополнительно участвует в deposit-эвристике и проверке дублей депозитных счетов.

Признаваемая цена: имя секции `sources` слегка растягивается. Прецедент уже есть — `ozon` и `wildberries` тоже не банки.

### Решение 2: ключ счёта кошелька выводится из валюты записи, а не из константы

`getCounterpartyAccount` для `CashOutAtm` возвращает `cash:${record.data.currency.toLowerCase()}` → `cash:rub`.

Так строка `cash:rub` не превращается в магическую константу, продублированную в коде и конфиге: код знает только схему `cash:<валюта>`, а конкретный HM-счёт живёт исключительно в конфиге. Добавление валютного кошелька сводится к одной строке в `accountMappings`.

Побочный эффект: если снятие произойдёт в валюте, для которой кошелёк не заведён, `getHmAccountId` вернёт `undefined`, и запись упадёт в `identified: false` с внятным сообщением о неразрешённом счёте — то же поведение, что и у любого другого неизвестного счёта. Это приемлемо: тихой потери данных нет, запись видна в превью.

**Альтернатива:** константа `CASH_ACCOUNT_ID = 'cash:rub'` в модуле. Отвергнута — жёстко привязывает код к одной валюте.

### Решение 3: guard `isBankPaymentRecord` расширяется точечным type guard'ом, банковская ветка не трогается

Вводится один module-private type guard:

```ts
function isCashOutAtmRecord(record: TochkaSyncRecord): record is CardTransactionInfoRecord {
  return isCardTransactionInfoRecord(record) && record.data.tranCode === 'CashOutAtm';
}
```

Он используется в трёх местах — `getNormalizedType`, `getCounterpartyAccount` и guard ветки перевода, — благодаря чему строка `'CashOutAtm'` встречается в коде ровно один раз.

Сам guard перевода расширяется, а не убирается:

```ts
if (!isBankPaymentRecord(sourceRecord) && !isCashOutAtmRecord(sourceRecord)) {
  throw new Error('Transfer must be a bank payment record or an ATM cash withdrawal');
}

// Снятие наличных по карте всегда исходящее: карточный счёт → кошелёк
const fromAccount = isBankPaymentRecord(sourceRecord) ? sourceRecord.data.payerAccountId : normalized.account;
const toAccount = isBankPaymentRecord(sourceRecord) ? sourceRecord.data.payeeAccountId : counterpartyAccountId;
```

Ключевое свойство: **банковская ветка остаётся дословно прежней** — те же `payerAccountId` / `payeeAccountId`, тот же порядок. Регрессия на пяти работающих transfer-сценариях становится структурно невозможной, а не «проверяемой тестами».

Направление для карточной записи задано константой, а не выведено: снятие всегда исходящее. Это осознанно — см. отвергнутую альтернативу ниже.

**Альтернативы:**

- *Вывести `from`/`to` из `normalized.account` + `counterpartyAccountId` + `incoming`.* Для всех пяти существующих сценариев такое выведение даёт верный ответ (проверено по таблице source/counterparty против payer/payee). Отвергнуто по двум причинам. Во-первых, эквивалентность держится не на коде, а на конфиге: `getSourceAccount` возвращает для `PaymentWrittenOff` всегда `payerAccountId`, а для `PaymentIncome` всегда `payeeAccountId`, без учёта направления — и если бы `PaymentWrittenOff` пришёл с `incoming = true`, `account` и `counterparty` схлопнулись бы в один и тот же счёт, а перевод построился бы сам в себя. Сейчас это невозможно только потому, что `included` в конфиге фиксирует направление. Во-вторых, направление бралось бы из `isBankPaymentRecord(...).incoming`, то есть «не-банковская запись всегда исходящая», — а это ровно то допущение, которое сломается на внесении наличных, причём тихо и задом наперёд.
- *Хелпер `getTransferLegs(record) → { from, to }` с веткой на каждое семейство.* Более общая форма, но на текущем объёме (одно новое семейство, направление константное) она перекладывает существующий рабочий код без выигрыша. К ней имеет смысл вернуться, когда появится второе не-банковское семейство с нетривиальным направлением — то есть при внесении наличных.

**Признаваемая цена:** два тернарника с одинаковым условием и `isBankPaymentRecord`, вызванный дважды. Терпимо на двух ветках; при третьей — повод достать `getTransferLegs`. Это стоит зафиксировать в `TECH-DEBT.md`.

### Решение 4: `included` только на `status = Withdraw`

Для `Purchase` в `included` включены оба статуса — `InProgress` и `Withdraw`. Для `CashOutAtm` берём только `Withdraw`.

Обоснование: наблюдаемый образец один и он в статусе `Withdraw`; поведение холда для снятия не подтверждено данными. Запись в статусе `InProgress` попадёт в `no matching included/excluded condition` — то есть будет видна в превью как неопознанная, а не потеряна молча. Это дешевле, чем включить непроверенный статус и получить дубль.

### Решение 5: категория для перевода не заводится

Перевод получает `category: null`, и downgrade «Category is missing» его не трогает — проверка ограничена `subtype` `i`/`e`. MCC `6011` в `categoryMapping.mcc` добавлять не нужно и не следует: если в будущем `CashOutAtm` по какой-то причине снова станет расходом, молчаливое наличие категории скроет проблему.

## Engineering Constraints

- **Типобезопасность.** `isCashOutAtmRecord` объявляется как `record is CardTransactionInfoRecord` и строится поверх существующего `isCardTransactionInfoRecord` — никаких `as` и `any`. Отдельная деталь: после проверки инварианта `if (normalized.type === 'transfer' && !normalized.counterpartyAccountId) throw` TypeScript **не** сужает тип свойства до `string`, поэтому `counterpartyAccountId` нужно захватить в локальную константу до проверки и дальше работать с ней, а не тянуть `as string`.
- **Обработка ошибок.** Сохраняется принятая в модуле дисциплина: `normalizeTochkaRecord` целиком обёрнут в `try/catch`, который превращает исключение в `{ identified: false, save: false, reason }`. Новый код не добавляет собственных `catch` и не глотает ошибки. Тексты сообщений о неразрешённых ногах обобщаются с `payer`/`payee` на `from`/`to`, поскольку для снятия «плательщик» — это карточный счёт; на тесты это не влияет, ни один из них не проверяет текст этих ошибок.
- **Границы модулей.** Изменения не выходят за `src/apply/preview/tochka.ts`. `src/config.ts`, `createAccountRegistry`, адаптеры и HM-клиент не трогаются. Новый type guard не экспортируется — публичная поверхность модуля не растёт.
- **Стиль и линт.** Новых модулей и паттернов не вводится, поэтому влияния на Biome-конфигурацию нет. `isCashOutAtmRecord` встаёт в существующий ряд `isXxxRecord` type guard'ов рядом с `isCardTransactionInfoRecord`. Именование — `camelCase`, ключи конфига — `kebab-case`, как у остальных `hmAccounts`.
- **Definition of Done.** `npm run check` (typecheck + Biome + vitest) проходит. Существующие transfer-тесты (`preview-PaymentAccepted`, `preview-PaymentIncome`, `preview-PaymentWrittenOff`, `preview-SbpB2CPayment`, `preview-SbpC2CPayment`) остаются зелёными без правок — это и есть проверка того, что рефакторинг ног не изменил поведение.

## Risks / Trade-offs

- **Изменение общего transfer-пути ломает работающие сценарии** → снято по конструкции: банковская ветка резолвинга ног не переписывается, а остаётся дословно прежней (`payerAccountId` / `payeeAccountId`), карточная добавляется вторым плечом тернарника. Существующие тесты пяти transfer-сценариев должны остаться зелёными без единой правки; если правки понадобятся — поведение поехало.
- **Два тернарника с одинаковым условием накопят третью ветку** → при появлении второго не-банковского семейства (внесение наличных, СБП-снятие) конструкция станет нечитаемой, и её нужно будет свернуть в `getTransferLegs`. Порог зафиксирован явно: третья ветка = сигнал к рефакторингу, запись заводится в `TECH-DEBT.md`.
- **`isOwned('cash:rub', …)` становится истинным** → практического эффекта нет: `isOwned` вызывается только на значениях `payerAccountId` / `payeeAccountId` / `recipientAccountId` из банковских записей, а формат `cash:<валюта>` не пересекается с номерами счетов РФ (20 цифр). Тем не менее это расширение семантики «owned», и его стоит держать в голове при следующем изменении реестра.
- **Двойной учёт, если траты наличными когда-то начнут импортироваться автоматически** → сейчас невозможно (источника наличных трат нет), но при появлении такого источника перевод и траты должны сходиться на одном и том же HM-счёте `5695`. Конфигурация это уже обеспечивает.
- **Расхождение `sources.json` и `sources.example.json`** → `config/sources.json` в `.gitignore`, поэтому реальный `id` кошелька в репозиторий не попадает; в example-файл кладётся обезличенное значение. Оба файла обновляются в одной задаче, чтобы не разъехались.
- **Строка `cash:` в двух слоях** (схема ключа в коде, конкретный ключ в конфиге) → неизбежная связность выбранного подхода. Минимизируется тем, что в коде она встречается ровно один раз, в `getCounterpartyAccount`.

## Migration Plan

Миграция данных не требуется — изменение затрагивает только классификацию новых записей на этапе превью.

Порядок выкладки:

1. обновить `config/sources.json` локально (источник `cash` + ветка `included`);
2. выкатить код;
3. прогнать `preview` на существующем синке и убедиться, что снятие 9000 ₽ от 2026-07-21 стало переводом, а остальные 89 записей окна не изменили классификацию.

Откат: убрать ветку `CashOutAtm` из `included` — запись вернётся в `no matching included/excluded condition`, то есть в текущее поведение. Источник `cash` при этом можно оставить, он инертен.

Исторические снятия за прошлые периоды переклассифицировать не планируется — по аналогии с решением, принятым для `PaymentClaim`.

## Open Questions

- Поведение `CashOutAtm` в статусе холда (`InProgress`) и наличие/формат отдельной записи комиссии за снятие сверх лимита не подтверждены данными. Оба вопроса решаются наблюдением при появлении таких записей в синке и не блокируют текущее изменение.
