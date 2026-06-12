## Context

`config/sources.json` уже содержит блоки нескольких банков под `sources` (`tochka`, `sber`, `tinkoff`), каждый со своими `hmAccounts` и `accountMappings`. Однако:

- Схема `AppConfigSchema` ([src/config.ts:51-56](src/config.ts#L51-L56)) описывает `sources: { tochka }`, поэтому Zod молча вырезает `sber`/`tinkoff` при `parse`.
- `loadConfig` ([src/config.ts:125-159](src/config.ts#L125-L159)) резолвит и кладёт в resolved-конфиг только `tochka`.
- `createAccountRegistry` ([src/config.ts:164-202](src/config.ts#L164-L202)) строит `isOwned`/`getHmAccountId` только над `tochka.accountMappings`.

Следствие: счёт-контрагент в другом банке не «мой» → `getNormalizedType` ([src/apply/preview/tochka.ts:376-379](src/apply/preview/tochka.ts#L376-L379)) не видит обе ноги owned → `SbpB2CPayment` Точка → Т-Банк классифицируется как `expense`.

Депозитная эвристика (`isDeposit`: BIC `044525104` + префикс `421`) — частная история Точки и остаётся как есть.

## Goals / Non-Goals

**Goals:**
- Распознавать как owned счета всех банков, перечисленных под `sources`.
- Резолвить `accountNumber → honeyMoneyAccountId` по объединённой карте всех банков — и для `isOwned`, и для `getHmAccountId`.
- Сохранить обратную совместимость формата `config/sources.json` (ранее игнорируемые блоки теперь учитываются).
- Не сломать существующую классификацию (правила `PaymentIncome`/`PaymentAccepted`, депозиты).

**Non-Goals:**
- Расширять депозитную эвристику на другие банки.
- Вводить матчинг владения по BIC (матчим по голому номеру счёта).
- Поддерживать per-bank `typeCodes`/правила классификации — правила остаются Tochka-специфичными.
- Импорт/синхронизацию транзакций из других банков (здесь только распознавание счетов как owned).

## Decisions

### 1. `sources` становится словарём банков, а не фиксированным `{ tochka }`
Меняем `AppConfigSchema.sources` и `ResolvedAppConfigSchema.sources` на `z.record(bankName, BankConfigSchema)` с требованием **хотя бы одного** определения банка (непустой `sources`, через `.refine(...)`). Конкретный ключ (`tochka`) на уровне схемы не обязателен.

- **Почему «хотя бы один банк», а не «обязательный tochka»:** схема не должна жёстко зашивать имя конкретного банка. `bankBic`/`typeCodes`/депозитная эвристика нужны лишь тому источнику, который реально обрабатывается (`apply tochka` → читаем `sources.tochka` в рантайме). Если соответствующего банка нет в конфиге — это рантайм-ошибка обработки источника, а не отказ загрузки конфига как такового.
- **Почему не оставить явные ключи `{ tochka, sber, tinkoff }`:** новый банк требовал бы правки схемы. `z.record` принимает любой набор.
- **Альтернатива (отклонена):** оставить `tochka` как есть и добавить отдельное поле `externalAccounts`. Дублирует структуру `hmAccounts`+`accountMappings`, расходится с уже существующим форматом JSON.

### 2. Объединённая карта `accountNumber → hmId` строится в `loadConfig`
`loadConfig` проходит по всем банкам, для каждого резолвит `accountMappings` против `hmAccounts` ТОГО ЖЕ банка (значение — ключ вида `"tinkoff-debetovaya"` → id из `tinkoff.hmAccounts`) и сливает в единую карту `Record<string, number>`.

- **Коллизии:** при попадании одного и того же номера счёта от двух банков с разными id — бросаем ошибку с указанием номера (симметрично существующей проверке дубликатов депозитов по валюте, [src/config.ts:119-123](src/config.ts#L119-L123)). Одинаковый id для одного номера — не ошибка (идемпотентно).

### 3. Реестр строится над объединённой картой; `getHmAccountId` обязателен к расширению вместе с `isOwned`
`createAccountRegistry` принимает объединённую карту вместо `tochka.accountMappings`. И `isOwned`, и `getHmAccountId` читают из неё.

- **Почему обязательно оба:** если расширить только `isOwned`, `getNormalizedType` вернёт `transfer`, а transfer-ветка `normalizeTochkaRecord` ([src/apply/preview/tochka.ts:559-568](src/apply/preview/tochka.ts#L559-L568)) тут же бросит `Unable to resolve payee HM account ID`. Из «молча неправильно» получится «громко падает». Оба метода читают единый источник, поэтому расширяются согласованно.
- `isDeposit` и его ветка в `getHmAccountId` (`421*` + валюта из позиций 5–7) не трогаются.

### 4. `src/apply/preview/tochka.ts` не меняется
`getNormalizedType` и transfer-ветка уже опираются на `registry.isOwned`/`getHmAccountId`. Достаточно изменений в `config.ts`. Это снижает риск регрессий в классификаторе.

## Risks / Trade-offs

- **Расширение владения влияет на ВСЕ type_code, а не только SBP** → правила `PaymentIncome`/`PaymentAccepted` используют `OWNED_PAYER`/`OWNED_PAYEE`. *Mitigation:* прогнать весь `src/apply/preview-*.test.ts`; направление изменения безопасно (раньше owned-счёт чужого банка не существовал, новых ложных «третьих лиц» не появляется — в маппингах только мои счета).
- **Коллизия номеров счетов между банками** → теоретически один номер у двух банков. *Mitigation:* fail-fast при загрузке конфига с понятной ошибкой.
- **Источник `tochka` отсутствует в конфиге** → классификатор и депозиты читают `sources.tochka` в рантайме; при отсутствии запись не обработается. *Mitigation:* схема требует непустой `sources`; обращение к конкретному источнику при обработке даёт понятную рантайм-ошибку, не падая на загрузке всего конфига.
- **Тип `AppConfig` меняется** (`sources.tochka` → `sources` как record) → затрагивает все места, читающие `config.sources.tochka`. *Mitigation:* TypeScript strict выявит все обращения на этапе компиляции; `tochka` по-прежнему доступен как `config.sources.tochka`.

## Migration Plan

1. Расширить схемы (`AppConfigSchema`, `ResolvedAppConfigSchema`) до record-формы с требованием непустого `sources` (хотя бы один банк).
2. Обновить `loadConfig`: резолв per-bank + сборка объединённой карты + проверка коллизий.
3. Обновить `createAccountRegistry` на объединённую карту.
4. Поправить обращения к `config.sources.*`, которые перестанут типизироваться.
5. Прогнать `npm run check` и весь preview-тест-набор; добавить тест кросс-банковского SBP-перевода.
6. Обновить `config/sources.example.json` и `TRANSACTION-RULES.md`.

Rollback: изменения изолированы в `config.ts` + конфиге; откат — revert коммита, формат JSON совместим в обе стороны.

## Open Questions

- Нужна ли валидация уникальности `hmAccounts`-ключей между банками, или они уже namespaced по банку? (текущее предположение: ключи глобально уникальны по соглашению; merge идёт по номеру счёта, не по ключу — так что коллизия ключей не критична).
