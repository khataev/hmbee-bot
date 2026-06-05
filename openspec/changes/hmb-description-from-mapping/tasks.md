## 1. Конфигурация: схема и типы

- [x] 1.1 Объявить тип `MappingEntry = { category: string; description?: string }` в `src/config.ts`
- [x] 1.2 Добавить `categoryMappingSchema = z.object({ mcc: z.record(...).default({}), title: z.record(...).default({}) })` в `HmbeeConfigSchema` и `ResolvedHmbeeConfigSchema`
- [x] 1.3 Прогнать `npm run check` — убедиться, что схема и типы корректны

## 2. Миграция данных в конфиг

- [x] 2.1 Перенести содержимое `data/tochka_mapping.txt` в `config/sources.json` под ключ `hmbee.categoryMapping` (mcc-записи → `mcc`, title-записи → `title`)
- [x] 2.2 Перенести те же данные в `config/sources.example.json`

## 3. Рефакторинг tochka.ts

- [x] 3.1 Удалить константы `MCC_MAP`, `TITLE_MAP`, `TITLE_REGEX_MAP` из `tochka.ts`
- [x] 3.2 При загрузке `categoryMapping` из конфига строить `titleRules: [RegExp, MappingEntry][]` из `Record<string, MappingEntry>`: `Object.entries(config.title).map(([pat, entry]) => [new RegExp(pat, 'i'), entry])`
- [x] 3.3 Обновить `mapTochkaCategory(description, mcc, categoryMapping)` — принимает `categoryMapping` из `AppConfig`, возвращает `MappingEntry | null`; title-поиск через `titleRules` (итерация с `regex.test(desc)`)
- [x] 3.4 Обновить `buildHoneyMoneyIncomeExpenseTransaction` — принимать `categoryMapping`, пробрасывать в `mapTochkaCategory`, формировать `description` по шаблону: `entry.description ? \`\${amount} \${entry.description}\` : String(amount)`
- [x] 3.5 Обновить `previewTochkaRecord` (и всю цепочку вызовов) — принимать и пробрасывать `categoryMapping` из `AppConfig`

## 4. Скрипт tochka-mapping.js

- [x] 4.1 Заменить логику записи: вместо append в `data/tochka_mapping.txt` — читать `config/sources.json`, обновить `hmbee.categoryMapping`, записать обратно; то же для `config/sources.example.json`
- [x] 4.2 Обновить логику дедупликации: проверять наличие ключа в `hmbee.categoryMapping.mcc` / `.title` вместо сканирования txt-строк
- [x] 4.3 Обновить `parseInputLine` — поддержать третье поле (description): всё после второй запятой (trim)
- [x] 4.4 Для `t`-маппинга добавить проверку: `new RegExp(titleValue, 'i').test(titleValue)`; при `false` или `SyntaxError` — вывести предупреждение и запросить паттерн вручную; если пользователь нажал Enter — сохранить исходный title
- [x] 4.5 Обновить подсказку в консоли: `Формат ввода: m(cc)|t(itle), "Название категории"[, Описание]`

## 5. Тесты

- [x] 5.1 Обновить фикстуры в `preview-*.test.ts` — добавить `categoryMapping` в mock-конфиг (пустой или с нужными записями)
- [x] 5.2 Добавить тест: при `categoryMapping` с `description` поле `hmbee.description = "${amount} ${desc}"`
- [x] 5.3 Добавить тест: при `categoryMapping` без `description` поле `hmbee.description = String(amount)`
- [x] 5.4 Добавить тест: при пустом `categoryMapping` категория = `null`, description = `String(amount)`

## 6. Финальная проверка

- [x] 6.1 Прогнать `npm run check` (typecheck + lint), устранить все ошибки
- [x] 6.2 Убедиться, что все существующие тесты проходят

## 7. Скрипт: regex-based dedup для title

- [x] 7.1 При загрузке существующего маппинга из конфига компилировать ключи `categoryMapping.title` в `RegExp[]`
- [x] 7.2 Заменить проверку `existingTitle.has(titleKey)` на `titleRegexes.some(rx => rx.test(titleKey))` — семантика совпадает с apply preview

## 8. Скрипт: ignore-список

- [ ] 8.1 Добавить в Zod-схему `categoryMapping` поле `ignored: { mcc: string[]; title: string[] }` с дефолтом `{ mcc: [], title: [] }`
- [ ] 8.2 При загрузке конфига включать `ignored.mcc` и `ignored.title` (как `RegExp[]`) в проверку auto-skip
- [ ] 8.3 Реализовать ввод `i` / `im` / `it`:
  - только mcc или только title: `i` → добавить в соответствующий список
  - оба поля: `i` → вывести `"Неверный ввод. Введите im или it"`, ждать повторного ввода; `im` / `it` → добавить в соответствующий список
  - для `it` / `i`(title) — переиспользовать UX-флоу с regex-предупреждением (задача 4.4)
- [ ] 8.4 Обновить подсказку в консоли: добавить `i(gnore)` в список допустимых команд
- [ ] 8.5 Прогнать `npm run check`, убедиться что все тесты проходят
