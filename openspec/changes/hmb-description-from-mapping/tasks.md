## 1. Конфигурация: схема и типы

- [ ] 1.1 Объявить тип `MappingEntry = { category: string; description?: string }` в `src/config.ts`
- [ ] 1.2 Добавить `categoryMappingSchema = z.object({ mcc: z.record(...).default({}), title: z.record(...).default({}) })` в `HmbeeConfigSchema` и `ResolvedHmbeeConfigSchema`
- [ ] 1.3 Прогнать `npm run check` — убедиться, что схема и типы корректны

## 2. Миграция данных в конфиг

- [ ] 2.1 Перенести содержимое `data/tochka_mapping.txt` в `config/sources.json` под ключ `hmbee.categoryMapping` (mcc-записи → `mcc`, title-записи → `title`)
- [ ] 2.2 Перенести те же данные в `config/sources.example.json`

## 3. Рефакторинг tochka.ts

- [ ] 3.1 Удалить константы `MCC_MAP`, `TITLE_MAP`, `TITLE_REGEX_MAP` из `tochka.ts`
- [ ] 3.2 При загрузке `categoryMapping` из конфига строить `titleRules: [RegExp, MappingEntry][]` из `Record<string, MappingEntry>`: `Object.entries(config.title).map(([pat, entry]) => [new RegExp(pat, 'i'), entry])`
- [ ] 3.3 Обновить `mapTochkaCategory(description, mcc, categoryMapping)` — принимает `categoryMapping` из `AppConfig`, возвращает `MappingEntry | null`; title-поиск через `titleRules` (итерация с `regex.test(desc)`)
- [ ] 3.4 Обновить `buildHoneyMoneyIncomeExpenseTransaction` — принимать `categoryMapping`, пробрасывать в `mapTochkaCategory`, формировать `description` по шаблону: `entry.description ? \`\${amount} \${entry.description}\` : String(amount)`
- [ ] 3.5 Обновить `previewTochkaRecord` (и всю цепочку вызовов) — принимать и пробрасывать `categoryMapping` из `AppConfig`

## 4. Скрипт tochka-mapping.js

- [ ] 4.1 Заменить логику записи: вместо append в `data/tochka_mapping.txt` — читать `config/sources.json`, обновить `hmbee.categoryMapping`, записать обратно; то же для `config/sources.example.json`
- [ ] 4.2 Обновить логику дедупликации: проверять наличие ключа в `hmbee.categoryMapping.mcc` / `.title` вместо сканирования txt-строк
- [ ] 4.3 Обновить `parseInputLine` — поддержать третье поле (description): всё после второй запятой (trim)
- [ ] 4.4 Для `t`-маппинга добавить проверку: `new RegExp(titleValue, 'i').test(titleValue)`; при `false` или `SyntaxError` — вывести предупреждение и запросить паттерн вручную; если пользователь нажал Enter — сохранить исходный title
- [ ] 4.5 Обновить подсказку в консоли: `Формат ввода: m(cc)|t(itle), "Название категории"[, Описание]`

## 5. Тесты

- [ ] 5.1 Обновить фикстуры в `preview-*.test.ts` — добавить `categoryMapping` в mock-конфиг (пустой или с нужными записями)
- [ ] 5.2 Добавить тест: при `categoryMapping` с `description` поле `hmbee.description = "${amount} ${desc}"`
- [ ] 5.3 Добавить тест: при `categoryMapping` без `description` поле `hmbee.description = String(amount)`
- [ ] 5.4 Добавить тест: при пустом `categoryMapping` категория = `null`, description = `String(amount)`

## 6. Финальная проверка

- [ ] 6.1 Прогнать `npm run check` (typecheck + lint), устранить все ошибки
- [ ] 6.2 Убедиться, что все существующие тесты проходят
