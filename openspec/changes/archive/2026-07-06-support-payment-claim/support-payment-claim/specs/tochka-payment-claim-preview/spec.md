## ADDED Requirements

### Requirement: Tochka preview поддерживает type_code PaymentClaim
Preview-классификатор Tochka SHALL распознавать записи с `type_code = "PaymentClaim"` как поддерживаемую форму и нормализовать их в income/expense-представление наравне с остальными RS-типами. Запись `PaymentClaim` SHALL НЕ приводить к результату `unsupported type_code`.

#### Scenario: PaymentClaim распознаётся как поддерживаемый тип
- **WHEN** синхронизированная Tochka-запись имеет `type_code = "PaymentClaim"`
- **THEN** preview-классификатор НЕ возвращает `reason = "unsupported type_code: PaymentClaim"`
- **AND** запись проходит нормализацию по правилам `PaymentClaim`

### Requirement: Нормализация полей записи PaymentClaim
При нормализации записи `PaymentClaim` система SHALL брать `transactionId` из `data.claimId`, статус из `data.objectState`, сумму из `data.sum`, валюту из `data.currency`, счёт-источник из `data.payerAccountId`. В отличие от прочих RS-типов, `description` SHALL браться из `data.purpose` (у `PaymentClaim` поле `data.title` равно `"No title"`).

#### Scenario: Поля маппятся из специфичных для PaymentClaim ключей
- **WHEN** запись `PaymentClaim` имеет `data.claimId`, `data.objectState`, `data.sum`, `data.currency`, `data.payerAccountId` и `data.purpose`
- **THEN** нормализованная запись содержит `transactionId = data.claimId`, `status = data.objectState`, `amount = data.sum`, `currency = data.currency`, `account = data.payerAccountId`
- **AND** `description = data.purpose`

### Requirement: PaymentClaim всегда классифицируется как expense
Система SHALL нормализовать любую записанную `PaymentClaim` как `type = "expense"`. Поле `data.direction` (например, `"IN"`) SHALL игнорироваться. Запись `PaymentClaim` SHALL НЕ участвовать в transfer-детекции: она не рассматривается как bank payment record (отсутствуют `payerBankBic`/`payeeBankBic`), поэтому `counterpartyAccountId` для неё не заполняется.

#### Scenario: PaymentClaim нормализуется как расход независимо от direction
- **WHEN** запись `PaymentClaim` имеет `data.direction = "IN"` и `data.payerAccountId`, принадлежащий моему счёту
- **THEN** нормализованный `type = "expense"`
- **AND** transfer-детекция не выполняется и `counterpartyAccountId` не заполняется

### Requirement: PaymentClaim сохраняется только в статусе Processed
Классификация `PaymentClaim` SHALL считать запись `included` (save-ready), когда `data.objectState == "Processed"`. `excluded`-предикат для `PaymentClaim` SHALL быть пустым. Записи в иных статусах SHALL получать `identified = false` по общему правилу «no matching included/excluded condition».

#### Scenario: Processed-запись помечается save-ready
- **WHEN** запись `PaymentClaim` имеет `data.objectState = "Processed"`
- **AND** резолюция категории по `purpose` возвращает непустую категорию
- **THEN** запись классифицируется как `identified = true`, `save = true`, `reason = null`

#### Scenario: Не-Processed запись не идентифицируется
- **WHEN** запись `PaymentClaim` имеет `data.objectState`, отличный от `"Processed"`
- **THEN** запись НЕ матчит ни `included`, ни `excluded`
- **AND** результат нормализации имеет `identified = false`, `reason = "no matching included/excluded condition"`

### Requirement: Поведение PaymentClaim покрыто фокусными тестами
Нормализация и классификация `PaymentClaim` SHALL быть покрыты отдельным тестовым файлом с фикстурами happy-path для двух известных сценариев: СМС-информирование и оплата лицензионного вознаграждения.

#### Scenario: Тесты валидируют happy-path сценарии PaymentClaim
- **WHEN** запускается тестовый набор preview-классификации
- **THEN** существует `src/apply/preview-PaymentClaim.test.ts`, проверяющий нормализацию записей `payment-claim-sms` и `payment-claim-license` в expense с корректной категорией
