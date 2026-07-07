## 1. Экспорт резолвера в основном коде

- [x] 1.1 Добавить `export` к функциям `mapTochkaCategory`, `getDescription`, `getMcc` в `src/apply/preview/tochka.ts` (без изменения сигнатур и тел)
- [x] 1.2 Прогнать `npm run typecheck` — убедиться, что экспорт не ломает типы/сборку

## 2. Учёт rules в авто-пропуске скрипта (пункт 3)

- [x] 2.1 В `scripts/tochka-mapping.js` импортировать `loadConfig`, `createAccountRegistry` (`src/config.js`) и `mapTochkaCategory`, `getDescription`, `getMcc` (`src/apply/preview/tochka.js`)
- [x] 2.2 Построить резолвнутый `categoryMapping` и `accountRegistry` из `loadConfig()` (в дополнение к сырому JSON, используемому для записи)
- [x] 2.3 Заменить вычисление `alreadyMapped`: считать запись покрытой, если `mapTochkaCategory(record, getDescription(record), getMcc(record), categoryMapping, accountRegistry) !== null` (сохранив отдельную проверку `ignored`)
- [x] 2.4 Переключить `map:tochka` в `package.json` на `npx tsx scripts/tochka-mapping.js`

## 3. Валидация паттерна и авто-== в rule-пути (пункт 1)

- [x] 3.1 В rule-пути (`handleRuleCommand`/`buildRule`) проверить, является ли `record.data.<field>` валидным self-matching regex (try/catch вокруг `new RegExp(value, 'i').test(value)`, как в `validateAndGetPattern`)
- [x] 3.2 При валидном regex — строить условие `{ matches: [value, { var: "record.data.<field>" }] }` (прежнее поведение)
- [x] 3.3 При невалидном/несовпадающем regex — печатать уведомление и строить `{ "==": [{ var: "record.data.<field>" }, value] }`; guard по `type_code` добавляется в обоих случаях

## 4. Проверка вручную и quality gate

- [ ] 4.1 Прогнать скрипт на `sync/tochka/*.json`: убедиться, что записи, покрытые существующими `rules` (`PaymentClaim` по `purpose`, `SbpB2CPayment` по `phoneNumber`), авто-пропускаются, а не переспрашиваются
- [ ] 4.2 Создать правило `r` по полю с regex-спецсимволом (например значение с ведущим `+`) — убедиться, что скрипт уведомляет и пишет `==`, а не битый `matches`
- [ ] 4.3 Создать правило `r` по обычному значению (без спецсимволов) — убедиться, что по-прежнему пишется `matches`
- [ ] 4.4 Прогнать `npm run check` (typecheck + Biome lint + vitest)
- [ ] 4.5 Свериться со STYLE-GUIDE.md и TRANSACTION-RULES.md
- [ ] 4.6 Провести ревью через `/opsx:review`, результат — в `openspec/changes/mapping-script-rules-aware/review.md`
