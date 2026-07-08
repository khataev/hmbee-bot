## 1. Loader возвращает данные вместе с границами интервала

- [ ] 1.1 Изменить `loadSyncFiles` в `src/apply/preview/loader.ts`: возвращать явный тип с записями и распарсенными `from`/`to` из имени файла (`<from>_<to>.json`) вместо `TochkaSyncRecord[]`
- [ ] 1.2 Добавить явную ошибку при некорректном/непарсящемся имени sync-файла
- [ ] 1.3 Обновить потребителей `loadSyncFiles` в `src/index.ts` под новый контракт
- [ ] 1.4 Обновить/добавить юнит-тесты loader на разбор `from`/`to` и на некорректное имя

## 2. Печать проблемных записей через describeSourceRecord

- [ ] 2.1 В `src/index.ts` убрать ветвление на `record.normalized`, всегда использовать `describeSourceRecord(record.sourceRecord as TochkaSyncRecord)` для id/описания проблемных записей
- [ ] 2.2 Проверить, что вывод (id, описание, reason) не изменился для записей с и без `normalized`

## 3. Sync удаляет предыдущий sync-файл

- [ ] 3.1 В команде `sync` (`src/index.ts`) перед записью нового файла удалять прочие `*.json` в `sync/<source>/` (только файловый режим; скоуп строго на подкаталог источника)
- [ ] 3.2 Не трогать директорию при `--stdout`
- [ ] 3.3 Добавить тесты: замена старого файла оставляет ровно один; `--stdout` не трогает директорию; `sync/hmbee/` не затронут

## 4. Apply форсит обновление HM-кэша

- [ ] 4.1 Добавить опцию `--skip-hmbee-cache-update` на команду `apply` в `src/index.ts`
- [ ] 4.2 Перед `loadCache()` (до skip-pass) выполнять refresh кэша: `validateHoneyMoneyEnv()` → `getAllTransactions()` → `trimEntries(all, from)` → `writeCache(...)`, где `from` берётся из результата loader; выполнять на всех режимах (включая `--preview`/`--preview-planned`), кроме случая `--skip-hmbee-cache-update`
- [ ] 4.3 При отказе refresh прерывать `apply` с классифицированной ошибкой (без утечки секретов), ничего не отправляя и не превьюя
- [ ] 4.4 Переиспользовать `trimEntries`/`writeCache` из `src/hmbee/cache.ts` без дублирования логики
- [ ] 4.5 Добавить тесты: refresh идёт до skip-pass; повторный apply не создаёт дублей; refresh идёт в preview; `--skip-hmbee-cache-update` не трогает кэш; отказ refresh прерывает run

## 5. Удаление --update-hmbee-cache из sync

- [ ] 5.1 Убрать опцию `--update-hmbee-cache` и связанный блок обновления кэша из команды `sync` в `src/index.ts`
- [ ] 5.2 Удалить/переиспользовать ставший неиспользуемым код обновления кэша в контексте sync
- [ ] 5.3 Обновить тесты sync под удалённый флаг

## 6. Документация и quality gate

- [ ] 6.1 Обновить упоминания `--update-hmbee-cache` и описания флоу в README/скриптах; при необходимости отметить в TECH-DEBT
- [ ] 6.2 Прогнать `npm run check` (Biome + tsc strict) и весь тестовый набор — зелёный
