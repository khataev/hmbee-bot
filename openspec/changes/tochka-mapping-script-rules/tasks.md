## 1. Вывод записи

- [ ] 1.1 Расширить инфо-строку в цикле `main()` полями `type_code` (`meta_data.system_data.type_code`) и `event_date` (`meta_data.time_data.event_date`)
- [ ] 1.2 Обновить подсказку по командам во вступительном выводе — добавить формат `r, <field>, "Категория"[, Описание]`

## 2. Разбор команды r

- [ ] 2.1 Добавить парсинг команды `r` (по образцу `parseInputLine` для `m`/`t`): извлечь `<field>`, `<Категория>` (через `normalizeCategory`), опциональное `<Описание>`
- [ ] 2.2 Обработать команду `r` в основном switch/цикле обработки ответа оператора

## 3. Валидация и построение правила

- [ ] 3.1 Проверить наличие и непустоту `record.data.<field>`; при отсутствии — предупреждение и возврат к промпту той же записи (правило не создаётся)
- [ ] 3.2 Построить объект правила: `{ when: { and: [ {"==":[{"var":"record.meta_data.system_data.type_code"}, <typeCode>]}, {"matches":[<полное record.data.<field>>, {"var":"record.data.<field>"}]} ] }, category, description? }`
- [ ] 3.3 Guard по `type_code` добавляется всегда; описание включается в правило только если оператор его ввёл

## 4. Запись в конфиг

- [ ] 4.1 Расширить `getCategoryMapping` — гарантировать наличие массива `rules` (ленивое создание)
- [ ] 4.2 Добавить функцию сохранения правила: append в `hmbee.categoryMapping.rules` и запись в `config/sources.json` (по образцу `saveMappingEntry`)
- [ ] 4.3 Вывести подтверждение сохранения (сериализованное правило), как для `m`/`t`

## 5. Проверка вручную и quality gate

- [ ] 5.1 Прогнать скрипт на `sync/tochka/*.json`: создать правило по `purpose` (`PaymentWrittenOff`), проверить корректность записи в `config/sources.json`
- [ ] 5.2 Проверить валидацию: `r` по отсутствующему полю (`phoneNumber` у `CardTransactionInfo`) не создаёт правило
- [ ] 5.3 Проверить, что созданное правило корректно резолвится runtime (preview на той же записи даёт ожидаемую категорию)
- [ ] 5.4 Прогнать `npm run check` (typecheck + Biome lint + vitest)
- [ ] 5.5 Свериться со STYLE-GUIDE.md и TRANSACTION-RULES.md
