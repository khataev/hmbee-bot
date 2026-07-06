## MODIFIED Requirements

### Requirement: Расширенные правила маппинга категории на JSON Logic
Система SHALL поддерживать в `config/sources.json` под ключом `hmbee.categoryMapping.rules` массив расширенных правил, каждое из которых определяет категорию через произвольное JSON Logic-условие над сырой записью Точки. Каждое правило SHALL иметь структуру `{ when: JsonLogic; category: string; description?: string }`, где выходная часть (`category`, `description`) эквивалентна `MappingEntry`. Правила SHALL вычисляться над контекстом `{ record }`, где `record` — сырая запись Точки (доступ через `{"var": "record.data.<field>"}`), тем же движком `evaluateRule`, что и правила `typeCodes`.

#### Scenario: Правило по подстроке purpose назначает категорию
- **WHEN** запись `PaymentClaim` имеет `data.purpose`, содержащий "смс-информирование"
- **AND** в `categoryMapping.rules` есть правило `{ when: { "and": [{ "==": [{ "var": "record.meta_data.system_data.type_code" }, "PaymentClaim"] }, { "matches": ["смс-информир", { "var": "record.data.purpose" }] }] }, category: "Банки / Периодические списания" }`
- **THEN** резолюция категории возвращает `MappingEntry` с `category = "Банки / Периодические списания"`

#### Scenario: Правило по purpose "лицензионное вознаграждение"
- **WHEN** запись `PaymentClaim` имеет `data.purpose`, содержащий "лицензионного вознаграждения"
- **AND** в `categoryMapping.rules` есть соответствующее правило с guard `type_code == "PaymentClaim"` и `category: "Банки / Периодические списания"`
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
