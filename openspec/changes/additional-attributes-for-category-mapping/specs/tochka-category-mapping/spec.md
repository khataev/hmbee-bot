## ADDED Requirements

### Requirement: Расширенные правила маппинга категории на JSON Logic
Система SHALL поддерживать в `config/sources.json` под ключом `hmbee.categoryMapping.rules` массив расширенных правил, каждое из которых определяет категорию через произвольное JSON Logic-условие над сырой записью Точки. Каждое правило SHALL иметь структуру `{ when: JsonLogic; category: string; description?: string }`, где выходная часть (`category`, `description`) эквивалентна `MappingEntry`. Правила SHALL вычисляться над контекстом `{ record }`, где `record` — сырая запись Точки (доступ через `{"var": "record.data.<field>"}`), тем же движком `evaluateRule`, что и правила `typeCodes`.

#### Scenario: Правило по подстроке purpose назначает категорию
- **WHEN** запись `PaymentWrittenOff` имеет `data.purpose`, содержащий "смс-информирование"
- **AND** в `categoryMapping.rules` есть правило `{ when: { "matches": ["смс-информир", { "var": "record.data.purpose" }] }, category: "Банки / Периодические списания" }`
- **THEN** резолюция категории возвращает `MappingEntry` с `category = "Банки / Периодические списания"`

#### Scenario: Правило по purpose "лицензионное вознаграждение"
- **WHEN** запись `PaymentWrittenOff` имеет `data.purpose`, содержащий "лицензионного вознаграждения"
- **AND** в `categoryMapping.rules` есть соответствующее правило с `category: "Банки / Периодические списания"`
- **THEN** резолюция категории возвращает `MappingEntry` с `category = "Банки / Периодические списания"`

#### Scenario: Правило по phoneNumber записи SbpB2CPayment
- **WHEN** запись `SbpB2CPayment` имеет `data.phoneNumber` равный целевому номеру
- **AND** в `categoryMapping.rules` есть правило `{ when: { "==": [{ "var": "record.data.phoneNumber" }, "<номер>"] }, category: "<категория>" }`
- **THEN** резолюция категории возвращает `MappingEntry` с этой категорией

#### Scenario: Правило по cardPanPart записи CardTransactionInfo
- **WHEN** запись `CardTransactionInfo` имеет `data.cardPanPart` равный целевому значению
- **AND** в `categoryMapping.rules` есть правило `{ when: { "==": [{ "var": "record.data.cardPanPart" }, "<pan>"] }, category: "<категория>" }`
- **THEN** резолюция категории возвращает `MappingEntry` с этой категорией

#### Scenario: Правило с description формирует описание транзакции
- **WHEN** совпавшее правило содержит поле `description`
- **THEN** возвращённый `MappingEntry` содержит это `description`
- **AND** дальнейшее формирование hmbee `description` использует его так же, как для entries из title/mcc

#### Scenario: Ни одно поле правила не совпало — правило не применяется
- **WHEN** у записи отсутствует поле, на которое ссылается `when` (значение `null`/`undefined`)
- **THEN** правило не матчится без выброса исключения
- **AND** резолюция продолжается со следующего слоя

### Requirement: Приоритет слоёв резолюции категории rules → title → mcc
Система SHALL проверять слои резолюции категории в порядке `rules`, затем `title`, затем `mcc`. Внутри `rules` SHALL применяться первое совпавшее правило (порядок в массиве = приоритет). Если хотя бы одно правило совпало — его `MappingEntry` возвращается, а слои `title` и `mcc` не проверяются. Слой `rules` SHALL дополнять существующую логику `title`/`mcc`, не изменяя их взаимный приоритет.

#### Scenario: Правило имеет приоритет над совпадающим title-паттерном
- **WHEN** description записи совпадает с title-паттерном, дающим категорию "Банки"
- **AND** одно из правил `rules` также совпадает с этой записью и даёт категорию "Банки / Периодические списания"
- **THEN** возвращается `MappingEntry` из правила ("Банки / Периодические списания"), а не из title

#### Scenario: Первое совпавшее правило побеждает
- **WHEN** несколько правил в `rules` совпадают с записью
- **THEN** возвращается `MappingEntry` первого совпавшего правила в порядке массива

#### Scenario: Ни одно правило не совпало — fallback на title
- **WHEN** ни одно правило в `rules` не совпадает с записью
- **AND** description совпадает с title-паттерном
- **THEN** возвращается `MappingEntry` из title-паттерна

#### Scenario: Нет ни правил, ни title, ни mcc — возвращается null
- **WHEN** ни одно правило не совпало
- **AND** description не совпал ни с одним title-паттерном
- **AND** у записи нет `mcc` или `mcc` отсутствует в `categoryMapping.mcc`
- **THEN** резолюция возвращает `null`

### Requirement: Кастомный json-logic оператор matches для регистронезависимого сопоставления
Система SHALL предоставлять в `ruleEngine.ts` кастомную json-logic операцию `matches`, принимающую `[pattern, value]` и возвращающую результат `new RegExp(pattern, 'i').test(String(value))` (регистронезависимый regex-матчинг). Некорректный паттерн SHALL приводить к несовпадению правила (без выброса наружу), опираясь на существующий `try/catch` в `evaluateRule`.

#### Scenario: matches находит подстроку без учёта регистра
- **WHEN** правило использует `{ "matches": ["смс", { "var": "record.data.purpose" }] }`
- **AND** `purpose` содержит "СМС-информирование" в другом регистре
- **THEN** оператор `matches` возвращает `true` и правило совпадает

#### Scenario: matches не совпадает при отсутствии подстроки
- **WHEN** правило использует `{ "matches": ["лицензи", { "var": "record.data.purpose" }] }`
- **AND** `purpose` не содержит эту подстроку
- **THEN** оператор `matches` возвращает `false` и правило не совпадает

#### Scenario: Некорректный regex-паттерн не ломает резолюцию
- **WHEN** правило содержит синтаксически некорректный regex-паттерн в `matches`
- **THEN** `evaluateRule` перехватывает ошибку и возвращает `false`
- **AND** резолюция продолжается со следующего правила/слоя

### Requirement: Конфиг с rules парсится и валидируется, отсутствие rules валидно
Система SHALL расширить Zod-схемы `categoryMappingSchema` и `ResolvedCategoryMappingSchema` в `src/config.ts` полем `rules` (массив правил `{ when, category, description? }`), а рантайм-тип `CategoryMapping` SHALL включать `rules`. Отсутствие `rules` в конфиге SHALL быть валидным со значением по умолчанию `[]`.

#### Scenario: Конфиг с rules парсится успешно
- **WHEN** `config/sources.json` содержит `hmbee.categoryMapping.rules` как непустой массив правил
- **THEN** `loadConfig()` парсит и валидирует правила через Zod-схему
- **AND** результирующий `AppConfig` предоставляет `hmbee.categoryMapping.rules` с корректными типами

#### Scenario: Конфиг без rules валиден
- **WHEN** `config/sources.json` не содержит `hmbee.categoryMapping.rules`
- **THEN** `loadConfig()` завершается успешно с `rules`, равным `[]`
- **AND** резолюция категории пропускает слой правил и работает как прежде (title → mcc)
