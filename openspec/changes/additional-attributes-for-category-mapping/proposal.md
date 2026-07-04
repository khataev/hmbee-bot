## Why

Категория honeymoney сейчас резолвится только по title (regex) или MCC. Этого недостаточно: многие транзакции невозможно отличить по этим двум полям. Например, PaymentWrittenOff с `purpose` "смс-информирование" и "лицензионного вознаграждения" оба матчатся по title `Банк Точка` → категория "Банки", хотя должны идти в "Банки / Периодические списания". Нужен механизм, учитывающий произвольные поля записи (`purpose`, `phoneNumber`, `cardPanPart` и др.).

## What Changes

- Добавить новый слой `rules` в `hmbee.categoryMapping` — массив расширенных правил на JSON Logic, работающих по любым полям сырой записи Точки.
- Каждое правило: `{ when: <JSONLogic>, category: string, description?: string }`. Форма выхода совпадает с существующим `MappingEntry`.
- Правила — **массив** (порядок = приоритет, первый матч побеждает), в отличие от `mcc`/`title`, где ключ строковый.
- Порядок резолюции в `mapTochkaCategory`: `rules → title → mcc` (от узкого к общему). Слой `rules` **дополняет**, а не заменяет текущую логику.
- Добавить кастомный json-logic оператор `matches` (regex, case-insensitive) в `ruleEngine.ts` для регистронезависимого поиска подстрок/паттернов в текстовых полях (`purpose` и др.). Встроенные операторы (`==`, `in`) остаются доступны.
- Контекст правила — `{ record }` (сырая запись Точки), ровно как у существующих `typeCodes`-правил. Правила пишутся как `{"var": "record.data.purpose"}`.
- Расширить Zod-схемы в `src/config.ts` (`categoryMappingSchema`, `ResolvedCategoryMappingSchema`) и рантайм-тип `CategoryMapping` полем `rules`.
- Отсутствие `rules` в конфиге валидно — поле по умолчанию `[]`, обратная совместимость сохраняется.

Не в объёме этого change (out-of-scope): доработка скрипта `map:tochka` (`scripts/tochka-mapping.js`) для интерактивного создания расширенных правил и авто-пропуска записей, уже покрытых `rules[]`. Это отдельная задача, обсуждается позже. Список `ignored` — чисто скриптовая штука (не рантайм) и в этом change не трогается.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `tochka-category-mapping`: добавляется третий слой резолюции категории — расширенные правила на JSON Logic поверх произвольных полей записи, с приоритетом над title и MCC; добавляется оператор `matches`; конфиг-схема расширяется полем `rules`.

## Impact

- `src/config.ts`: `categoryMappingSchema`, `ResolvedCategoryMappingSchema`, тип `CategoryMapping`, загрузка/резолв правил в `loadConfig()`.
- `src/apply/preview/ruleEngine.ts`: новый кастомный оператор `matches`.
- `src/apply/preview/tochka.ts`: `mapTochkaCategory` получает `sourceRecord` и проверяет `rules` перед title/mcc.
- `config/sources.json`, `config/sources.example.json`: новый ключ `hmbee.categoryMapping.rules` (опциональный).
- Тесты: новые preview-тесты по образцу `src/apply/preview-*.test.ts`.
- Quality gate: `npm run check` (typecheck + Biome lint + vitest) должен проходить.
