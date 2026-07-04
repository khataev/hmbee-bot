## 1. Config schema и типы

- [x] 1.1 Добавить `RuleEntrySchema` (`{ when: JsonLogicRule; category: string; description?: string }`) в `src/config.ts`, переиспользуя существующий `JsonLogicRuleSchema`
- [x] 1.2 Расширить `categoryMappingSchema` полем `rules` (массив `RuleEntrySchema`, default `[]`)
- [x] 1.3 Расширить `ResolvedCategoryMappingSchema` полем `rules` и обновить дефолт `categoryMapping` в `HmbeeConfigSchema`
- [x] 1.4 Обновить тип `CategoryMapping` (`Omit<..., 'ignored'>`) так, чтобы он включал `rules`; экспортировать тип правила (`RuleEntry`)
- [x] 1.5 Проброс `rules` в `loadConfig()` при сборке `ResolvedAppConfigSchema` (сырой JSON Logic, без предкомпиляции regex)

## 2. Оператор matches в ruleEngine

- [x] 2.1 Добавить кастомную json-logic операцию `matches` в `src/apply/preview/ruleEngine.ts`: `[pattern, value] => new RegExp(pattern, 'i').test(String(value))`, по образцу `is_owned`/`is_deposit`
- [x] 2.2 Убедиться, что некорректный regex ловится существующим `try/catch` в `evaluateRule` и приводит к `false`

## 3. Слой rules в резолюции категории

- [ ] 3.1 Изменить сигнатуру `mapTochkaCategory` в `src/apply/preview/tochka.ts` на `(sourceRecord, description, mcc, categoryMapping, accountRegistry)` (или эквивалентный проброс `accountRegistry`)
- [ ] 3.2 Добавить проверку `rules` первым слоем: для каждого правила вызвать `evaluateRule(rule.when, { record: sourceRecord, accountRegistry })`, вернуть `MappingEntry` первого совпавшего
- [ ] 3.3 Сохранить существующий порядок `title → mcc` как fallback после `rules`
- [ ] 3.4 Обновить вызов `mapTochkaCategory` в `buildHoneyMoneyIncomeExpenseTransaction`, пробросив `sourceRecord` и `accountRegistry`

## 4. Конфиг-файлы

- [ ] 4.1 Добавить примеры правил в `config/sources.example.json` под `hmbee.categoryMapping.rules` (purpose "смс-информирование" и "лицензионного вознаграждения" → "Банки / Периодические списания")
- [ ] 4.2 Добавить реальные правила в `config/sources.json` при необходимости (по согласованию)

## 5. Тесты

- [ ] 5.1 Тест: правило по подстроке `purpose` для `PaymentWrittenOff` "смс-информирование" → "Банки / Периодические списания"
- [ ] 5.2 Тест: правило по подстроке `purpose` для `PaymentWrittenOff` "лицензионного вознаграждения" → "Банки / Периодические списания"
- [ ] 5.3 Тест: правило по `phoneNumber` для `SbpB2CPayment`
- [ ] 5.4 Тест: правило по `cardPanPart` для `CardTransactionInfo`
- [ ] 5.5 Тест приоритета: правило перехватывает запись, совпадающую и с title-паттерном
- [ ] 5.6 Тест: первое совпавшее правило побеждает при нескольких совпадениях
- [ ] 5.7 Тест: некорректный regex в `matches` не ломает резолюцию (fallback на следующий слой)
- [ ] 5.8 Тест config: конфиг без `rules` валиден (`rules = []`); конфиг с `rules` парсится
- [ ] 5.9 Добавить фикстуры записей при необходимости по образцу `src/apply/preview/fixtures/`

## 6. Quality gate

- [ ] 6.1 Прогнать `npm run check` (typecheck + Biome lint + vitest), устранить замечания
- [ ] 6.2 Свериться со STYLE-GUIDE.md и TRANSACTION-RULES.md

## 7. Out-of-scope (follow-up, НЕ в этом change)

- [ ] 7.1 Отдельная задача: доработка `scripts/tochka-mapping.js` (`map:tochka`) — интерактивное создание расширенных правил и авто-пропуск записей, уже покрытых `rules[]`. Обсудить отдельно.
