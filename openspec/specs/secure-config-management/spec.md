# secure-config-management

## Purpose
Management of sensitive configuration and credentials for source adapters and target system operations.

## Requirements

### Requirement: Secure Configuration Loading
The system SHALL prioritize environment-based configuration for sensitive source identifiers like `customerId`.

#### Scenario: Environment variable validation
- **WHEN** `validateTochkaEnv()` is called
- **THEN** it must ensure `TOCHKA_CUSTOMER_ID` is present and non-empty.

### Requirement: Honey Money write operations require validated local secrets
The system SHALL validate required Honey Money authentication and request settings from the local environment before attempting any write operation.

#### Scenario: Missing Honey Money apply variable
- **WHEN** the operator runs `apply <source>` without one or more required Honey Money environment variables
- **THEN** the system fails before making any Honey Money request
- **AND** the error identifies which Honey Money environment variables are missing or invalid

### Requirement: Honey Money account mappings remain in non-secret local configuration
The system SHALL load bank-account-to-Honey-Money account mappings from versioned local configuration rather than from environment secrets, for every bank configured under `sources`.

#### Scenario: Resolve Honey Money account id from local mapping config
- **WHEN** the application loads local configuration for a configured bank source
- **THEN** it reads the configured Honey Money account catalog and account mappings for that bank from `config/sources.json`
- **AND** it resolves the final Honey Money account id for each configured account without requiring that mapping in environment variables

#### Scenario: Account mappings of all configured banks are loaded
- **WHEN** the application loads local configuration and `config/sources.json` defines more than one bank under `sources` (for example `tochka`, `sber`, `tinkoff`)
- **THEN** the resolved configuration includes the account mappings of every configured bank
- **AND** no configured bank block is silently dropped during schema parsing

#### Scenario: Duplicate account number across banks is rejected
- **WHEN** the application loads local configuration
- **AND** the same account number is mapped under two different banks to different Honey Money account ids
- **THEN** configuration loading fails with an error that identifies the conflicting account number

### Requirement: Конфигурация приложения требует обязательного поля time_zone
Система SHALL требовать наличия поля `time_zone` на корневом уровне файла `config/sources.json` и завершать загрузку с ошибкой, если поле отсутствует или не является строкой.

#### Scenario: Поле time_zone принимается при загрузке конфигурации
- **WHEN** `config/sources.json` содержит поле `"time_zone": "Europe/Moscow"` на корневом уровне
- **THEN** конфигурация загружается без ошибок
- **AND** значение `time_zone` доступно в резолвенной конфигурации приложения

#### Scenario: Отсутствие поля time_zone вызывает ошибку загрузки
- **WHEN** `config/sources.json` не содержит поля `time_zone` на корневом уровне
- **THEN** загрузка конфигурации завершается с ошибкой
- **AND** сообщение об ошибке указывает на отсутствующее поле `time_zone`

### Requirement: Запросы к Honey Money не зависят от session-cookie
Система SHALL авторизовывать запросы к Honey Money заголовком `user-token` и NOT SHALL требовать или отправлять session-cookie, поскольку экспериментально подтверждено, что cookie не несёт авторизации.

#### Scenario: Запрос к Honey Money без cookie
- **WHEN** система выполняет запись или чтение в Honey Money (`createTransaction`, `confirmPlannedTransaction`, чтение `all_json`)
- **THEN** запрос отправляется с заголовками `user-email` и `user-token`
- **AND** заголовок `cookie` в запросе не передаётся

#### Scenario: HM_COOKIE не является требуемым секретом
- **WHEN** валидируется окружение для операций Honey Money
- **THEN** отсутствие или пустое значение `HM_COOKIE` не приводит к ошибке валидации
- **AND** `HM_COOKIE` не входит в набор обязательных переменных окружения
