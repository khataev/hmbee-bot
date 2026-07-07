## MODIFIED Requirements

### Requirement: tochka-mapping.js создаёт расширенные правила командой r
Скрипт `scripts/tochka-mapping.js` SHALL поддерживать команду `r, <field>, <Категория>[, <Описание>]`, которая создаёт расширенное правило категории и дописывает его в конец массива `hmbee.categoryMapping.rules` в `config/sources.json`. Правило SHALL строиться по идиоме `AND(type_code guard, <условие по полю>)`, где guard по `type_code` добавляется всегда, а условие по полю выбирается по валидности значения как regex:

- если `record.data.<field>` — валидный self-matching regex (`new RegExp(value, 'i').test(value)` возвращает `true` без исключения), условие SHALL быть `{ "matches": [ "<полное значение поля>", { "var": "record.data.<field>" } ] }`;
- иначе скрипт SHALL напечатать уведомление и построить условие точного сравнения `{ "==": [ { "var": "record.data.<field>" }, "<полное значение поля>" ] }` вместо `matches`.

Скрипт SHALL только конструировать объект правила и записывать его в конфиг; он SHALL NOT реализовывать собственный оператор `matches`.

#### Scenario: Валидное regex-значение — правило использует matches
- **WHEN** оператор вводит `r, purpose, Банки / Периодические списания, СМС` для записи с `type_code = "PaymentClaim"` и `data.purpose`, являющимся валидным regex
- **THEN** в `hmbee.categoryMapping.rules` дописывается правило с `when.and[0]` = `{ "==": [ { "var": "record.meta_data.system_data.type_code" }, "PaymentClaim" ] }`
- **AND** `when.and[1]` = `{ "matches": [ <полное значение data.purpose>, { "var": "record.data.purpose" } ] }`
- **AND** `category = "Банки / Периодические списания"` и `description = "СМС"`

#### Scenario: Значение с regex-спецсимволом — правило использует == и уведомление
- **WHEN** оператор вводит `r, phoneNumber, Дача / Услуги` для записи `SbpB2CPayment` с `data.phoneNumber = "+79604000382"`
- **AND** `new RegExp("+79604000382", 'i')` бросает `SyntaxError`
- **THEN** скрипт печатает уведомление о том, что значение не является валидным regex и будет использовано точное сравнение
- **AND** `when.and[1]` = `{ "==": [ { "var": "record.data.phoneNumber" }, "+79604000382" ] }` (а не `matches`)
- **AND** `when.and[0]` — guard `type_code == "SbpB2CPayment"`

#### Scenario: Guard по type_code добавляется всегда
- **WHEN** оператор создаёт правило командой `r`
- **THEN** сгенерированное `when` ВСЕГДА содержит `and` с условием равенства `type_code` типу текущей записи
- **AND** вариант правила без guard недоступен

#### Scenario: Описание опционально
- **WHEN** оператор вводит `r, cardPanPart, Дети / Карманные` без третьего поля
- **THEN** сохранённое правило не содержит поле `description`

#### Scenario: Правило дописывается в конец rules[]
- **WHEN** в `hmbee.categoryMapping.rules` уже есть правила
- **AND** оператор создаёт новое правило командой `r`
- **THEN** новое правило добавляется в конец массива, существующие правила сохраняются в прежнем порядке

#### Scenario: Ключ rules создаётся при первом правиле
- **WHEN** `hmbee.categoryMapping` не содержит `rules`
- **AND** оператор создаёт первое правило командой `r`
- **THEN** массив `rules` создаётся и в него записывается новое правило

## REMOVED Requirements

### Requirement: Авто-пропуск не учитывает расширенные правила
**Reason**: Ограничение снимается — авто-пропуск теперь учитывает `rules` через переиспользование рантаймового резолвера `mapTochkaCategory`. Заменяется требованием «Авто-пропуск учитывает все слои резолюции категории через общий резолвер».
**Migration**: Записи, покрытые только правилом `rules[]`, теперь авто-пропускаются вместо переспрашивания. Поведение для `mcc`/`title`/`ignored` не меняется.

## ADDED Requirements

### Requirement: Авто-пропуск учитывает все слои резолюции категории через общий резолвер
Логика авто-пропуска скрипта `scripts/tochka-mapping.js` SHALL определять «уже покрыто категорией» переиспользованием рантаймового резолвера `mapTochkaCategory` из `src/apply/preview/tochka.ts` (экспортируемого без изменения сигнатуры). Запись SHALL считаться покрытой (авто-пропуск), если `mapTochkaCategory(record, getDescription(record), getMcc(record), categoryMapping, accountRegistry)` возвращает не `null`, то есть если совпадает любой слой `rules`, `title` или `mcc`. Скрипт SHALL получать резолвнутый `categoryMapping` и `accountRegistry` через `loadConfig()`/`createAccountRegistry()`; проверка `ignored` (`mcc`/`title`) остаётся отдельной и без изменений. Скрипт SHALL NOT дублировать резолвер — он вызывает общий код, устраняя дрейф между скриптом и рантаймом.

#### Scenario: Запись, покрытая только правилом, авто-пропускается
- **WHEN** запись не совпадает ни с одним `mcc`/`title`-паттерном, но покрыта правилом в `hmbee.categoryMapping.rules`
- **THEN** `mapTochkaCategory` возвращает не `null`
- **AND** скрипт авто-пропускает запись, а не показывает промпт оператору

#### Scenario: Запись, покрытая title-паттерном, авто-пропускается (регрессия сохранена)
- **WHEN** description записи совпадает с title-паттерном в `categoryMapping.title`
- **THEN** скрипт авто-пропускает запись

#### Scenario: Запись, покрытая mcc, авто-пропускается (регрессия сохранена)
- **WHEN** `mcc` записи присутствует в `categoryMapping.mcc` и ни один слой выше не совпал
- **THEN** скрипт авто-пропускает запись

#### Scenario: Непокрытая запись переспрашивается
- **WHEN** `mapTochkaCategory` возвращает `null` для записи
- **AND** запись не в списке `ignored`
- **THEN** скрипт показывает промпт оператору для создания маппинга или правила

#### Scenario: Приоритет и нюанс поля наследуются от рантайма
- **WHEN** скрипт вычисляет покрытие для записи `PaymentClaim`
- **THEN** используется тот же порядок слоёв `rules → title → mcc` и то же поле для title-матчинга (`purpose` для `PaymentClaim`, `title` для остальных), что и в рантайме
