## Why

Поле `description` в транзакциях Honey Money формируется только из суммы (`String(Math.abs(amount))`), хотя пользователи ожидают шаблон `${amount} ${текст}` (например, `"3547 билеты на хоккей"`). При этом `MCC_MAP` и `TITLE_MAP` захардкожены в `tochka.ts` — маппинг нельзя менять без правки кода. Файл `data/tochka_mapping.txt` пишется скриптом, но не используется.

## What Changes

- В конфигурацию `config/sources.json` и `config/sources.example.json` добавляется ключ `hmbee.categoryMapping` со структурой `{ mcc: Record<string, MappingEntry>, title: Record<string, MappingEntry> }`, где `MappingEntry = { category: string; description?: string }`.
- Содержимое `data/tochka_mapping.txt` переносится в `hmbee.categoryMapping` обоих конфиг-файлов.
- Захардкоженные `MCC_MAP` и `TITLE_MAP` в `tochka.ts` удаляются; маппинг загружается из конфига через `loadConfig()`.
- `TITLE_MAP` переводится из `[string, string][]` в `Record<string, MappingEntry>` для O(1) lookup по ключу.
- Скрипт `scripts/tochka-mapping.js` теперь записывает маппинги напрямую в `config/sources.json` и `config/sources.example.json` (JSON-обновление), принимая третье опциональное поле — описание.
- `buildHoneyMoneyIncomeExpenseTransaction` формирует `description` по шаблону `"${amount} ${entry.description}"` если `description` есть в маппинге, иначе `"${amount}"`.
- Transfer-транзакции не затрагиваются.

## Capabilities

### New Capabilities

- `tochka-category-mapping`: Конфигурационный маппинг MCC/title → `{ category, description? }` в `hmbee.categoryMapping`; формирование `description` транзакции по шаблону.

### Modified Capabilities

- `source-preview`: Меняется источник маппинга категорий (конфиг вместо кода) и формирование поля `description` при построении hmbee-транзакции.

## Impact

- `config/sources.json`, `config/sources.example.json` — новый ключ `hmbee.categoryMapping`.
- `src/config.ts` — расширение схемы `HmbeeConfigSchema` / `ResolvedHmbeeConfigSchema` полем `categoryMapping`.
- `scripts/tochka-mapping.js` — новая цель записи (JSON-файлы конфига), новый опциональный формат ввода.
- `src/apply/preview/tochka.ts` — удаление `MCC_MAP` / `TITLE_MAP`, получение маппинга из `AppConfig`, рефакторинг `mapTochkaCategory`.
- Тесты в `src/apply/preview-*.test.ts` — передача маппинга через конфиг-фикстуру.
- `data/tochka_mapping.txt` — более не используется (можно удалить после миграции).
- `npm run check` должен проходить без ошибок.
