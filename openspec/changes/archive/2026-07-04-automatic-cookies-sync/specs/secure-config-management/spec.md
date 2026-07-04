## ADDED Requirements

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
