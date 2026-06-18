# tochka-category-mapping

## Purpose
Configuration and tooling for MCC and title-based category mapping for Tochka source records. TBD.

## Requirements

### Requirement: Category mapping is stored in application config under hmbee.categoryMapping
The system SHALL store MCC and title-based category mapping in `config/sources.json` under the key `hmbee.categoryMapping`, with structure `{ mcc: Record<string, MappingEntry>, title: Record<string, MappingEntry> }` where `MappingEntry = { category: string; description?: string }`.

#### Scenario: Config with categoryMapping is parsed successfully
- **WHEN** `config/sources.json` contains `hmbee.categoryMapping` with `mcc` and/or `title` sub-objects
- **THEN** `loadConfig()` parses and validates the mapping via Zod schema
- **AND** the resulting `AppConfig` exposes `hmbee.categoryMapping` with correct types

#### Scenario: Config without categoryMapping is valid
- **WHEN** `config/sources.json` does not contain `hmbee.categoryMapping`
- **THEN** `loadConfig()` succeeds with `categoryMapping` defaulting to `{ mcc: {}, title: {} }`

### Requirement: Mapping entry carries optional description
Each mapping entry SHALL support an optional `description` field that, when present, is appended to the transaction amount to form the hmbee `description` value.

#### Scenario: Mapping entry with description produces combined description
- **WHEN** an identified Tochka record is matched to a mapping entry that has a `description` field
- **THEN** the hmbee transaction `description` is `"${Math.abs(amount)} ${entry.description}"`

#### Scenario: Mapping entry without description produces amount-only description
- **WHEN** an identified Tochka record is matched to a mapping entry without `description`
- **THEN** the hmbee transaction `description` is `String(Math.abs(amount))`

#### Scenario: Unmatched record produces amount-only description
- **WHEN** an identified Tochka record does not match any mapping entry
- **THEN** the hmbee transaction `description` is `String(Math.abs(amount))`

### Requirement: tochka-mapping.js script writes mappings to config JSON files
The `scripts/tochka-mapping.js` script SHALL write mapping entries directly into `config/sources.json` and `config/sources.example.json` under `hmbee.categoryMapping`, replacing the previous append-to-txt approach.

#### Scenario: New mcc entry is written to both config files
- **WHEN** the operator enters `m, Категория` for a transaction with an mcc value
- **THEN** `config/sources.json` is updated with `hmbee.categoryMapping.mcc[mccValue] = { category }`
- **AND** `config/sources.example.json` is updated identically

#### Scenario: New title entry with description is written to both config files
- **WHEN** the operator enters `t, Категория, Описание` for a transaction with a title value
- **THEN** `config/sources.json` is updated with `hmbee.categoryMapping.title[titleValue] = { category, description }`
- **AND** `config/sources.example.json` is updated identically

#### Scenario: Existing key is overwritten
- **WHEN** the operator enters a mapping for an mcc or title that already exists in `hmbee.categoryMapping`
- **THEN** the existing entry is replaced with the new values

#### Scenario: Input without description saves entry without description field
- **WHEN** the operator enters `m, Категория` or `t, Категория` (no third field)
- **THEN** the saved entry does not include a `description` field

### Requirement: tochka-mapping.js script accepts optional description as third input field
The script SHALL accept an optional third comma-separated field as the description value.

#### Scenario: Third field is captured as description
- **WHEN** the operator enters `m, Покупки / Продукты, сыродавленное масло`
- **THEN** the description `"сыродавленное масло"` is stored in the mapping entry

#### Scenario: Input prompt reflects updated format
- **WHEN** the script starts
- **THEN** the console displays: `Формат ввода: m(cc)|t(itle), "Название категории"[, Описание]`

### Requirement: tochka-mapping.js warns when title does not self-match as regex
After the operator enters a `t`-mapping, the script SHALL check whether the transaction title matches the pattern (the title itself used as a regex). If the check fails or throws, the script SHALL warn and offer to enter a custom pattern.

#### Scenario: Title self-matches as regex — no warning
- **WHEN** the operator enters a `t`-mapping
- **AND** `new RegExp(titleValue, 'i').test(titleValue)` returns `true`
- **THEN** no warning is shown and the title is saved as the pattern

#### Scenario: Title does not self-match as regex — warning shown
- **WHEN** the operator enters a `t`-mapping
- **AND** `new RegExp(titleValue, 'i').test(titleValue)` returns `false` or throws a `SyntaxError`
- **THEN** the script displays a warning message indicating the pattern does not match the title
- **AND** the script prompts the operator to enter a custom regex pattern

#### Scenario: Operator provides custom regex pattern
- **WHEN** the warning is shown and the operator enters a non-empty custom pattern
- **THEN** the custom pattern is saved as the key in `hmbee.categoryMapping.title` instead of the raw title
- **AND** the operator is solely responsible for the correctness of the custom pattern

#### Scenario: Operator skips custom pattern input
- **WHEN** the warning is shown and the operator presses Enter without typing
- **THEN** the original title string is saved as the pattern as-is

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
