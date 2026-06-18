## ADDED Requirements

### Requirement: Title-паттерны имеют приоритет над MCC при определении категории
Система SHALL проверять title-паттерны перед MCC при резолюции категории транзакции. Если хотя бы один title-паттерн совпадает с description транзакции — возвращается соответствующий `MappingEntry`. MCC используется только как fallback, если ни один title-паттерн не совпал.

#### Scenario: Title-паттерн совпадает — MCC игнорируется
- **WHEN** транзакция имеет `mcc`, которому соответствует запись в `categoryMapping.mcc`
- **AND** description транзакции совпадает с одним из title-паттернов в `categoryMapping.title`
- **THEN** возвращается `MappingEntry` из title-паттерна, а не из MCC

#### Scenario: Title-паттерн не совпадает — используется MCC
- **WHEN** транзакция имеет `mcc`, которому соответствует запись в `categoryMapping.mcc`
- **AND** description транзакции не совпадает ни с одним title-паттерном
- **THEN** возвращается `MappingEntry` из `categoryMapping.mcc`

#### Scenario: Нет ни title-совпадения, ни MCC — возвращается null
- **WHEN** description транзакции не совпадает ни с одним title-паттерном
- **AND** транзакция не имеет `mcc` или `mcc` отсутствует в `categoryMapping.mcc`
- **THEN** функция возвращает `null`
