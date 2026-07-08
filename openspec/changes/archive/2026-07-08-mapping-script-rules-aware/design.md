# Design — mapping-script-rules-aware

## Контекст

`scripts/tochka-mapping.js` — интерактивный CLI на чистом Node ESM (`node scripts/tochka-mapping.js`). Рантаймовый резолвер категории `mapTochkaCategory` живёт в `src/apply/preview/tochka.ts` (TypeScript, алиасные импорты `src/*`, зависимость `json-logic-js` через `ruleEngine.ts`). Скрипт исторически повторял подмножество этой логики (`mcc`/`title`) в `alreadyMapped` и разошёлся с рантаймом (нет `rules`).

## Ключевое решение: reuse через export, без изменения сигнатур

Оператор явно ограничил: не менять сигнатуры функций и не выносить код; `export` существующих функций допустим.

- `mapTochkaCategory`, `getDescription`, `getMcc` в `tochka.ts` получают модификатор `export`. Тела и сигнатуры не трогаем.
- Скрипт вызывает `mapTochkaCategory(record, getDescription(record), getMcc(record), categoryMapping, accountRegistry)` и трактует `!== null` как «покрыто категорией».
- Альтернативы (вынос в `categoryResolver.ts`; дублирование `json-logic` в скрипте) отклонены: первая инвазивнее к основному коду, вторая сохраняет риск дрейфа. Reuse устраняет дрейф по построению.

## Резолвнутый vs сырой конфиг

`mapTochkaCategory` ожидает **резолвнутый** `CategoryMapping`, где `title` — массив `{ pattern: RegExp, entry }` (см. `ResolvedCategoryMappingSchema`), а не сырой `Record<string,entry>` из JSON. Поэтому скрипт:

- для проверки `alreadyMapped` берёт конфиг через `loadConfig()` (Zod-резолв) и строит `accountRegistry` через `createAccountRegistry(config)`;
- для записи новых правил продолжает read-modify-write **сырого** JSON (`loadJsonFile`/`saveJsonFile` по `config/sources.json`), чтобы не терять форматирование и незнакомые ключи.

Двойная загрузка (resolved для чтения-решения, raw для записи) — осознанная: резолвнутая форма для запроса, сырая для мутации.

## Запуск через tsx

Импорт `.ts` по алиасу `src/*` из `.js`-скрипта требует раннера, понимающего tsconfig `paths`. `npm run dev` (`npx tsx src/index.ts`) доказывает, что `tsx` уже резолвит алиас в проекте. Поэтому `map:tochka` переключается на `npx tsx scripts/tochka-mapping.js`. Файл остаётся `.js` (tsx исполняет `.js`, резолвя `.ts`-импорты); переименование в `.ts` не требуется.

## Валидация паттерна в rule-пути (пункт 1)

`buildRule` сейчас безусловно эмитит `matches`. Новое поведение:

```
value = record.data[field]
selfMatches = try { new RegExp(value, 'i').test(value) } catch { false }
if selfMatches → condition = { matches: [value, { var: `record.data.${field}` }] }   // как раньше
else           → уведомить оператора; condition = { "==": [{ var: `record.data.${field}` }, value] }
```

Проверка идентична `validateAndGetPattern`, но лекарство другое: для `title` — ручной ввод паттерна, для правил — авто-`==` (точное сравнение семантически верно для телефонов/идентификаторов). Guard по `type_code` добавляется как и прежде.

## Engineering Constraints

- **Type safety:** экспортируемые функции сохраняют текущие сигнатуры; никаких `any` в скрипте на границе с `mapTochkaCategory` — использовать возвращаемый `MappingEntry | null`.
- **Error handling:** `alreadyMapped` не должен падать на «грязных» записях; `mapTochkaCategory` уже возвращает `null` при непокрытии и не бросает на невалидных паттернах (через `evaluateRule` try/catch). Regex-проверка в rule-пути обёрнута в try/catch (как `validateAndGetPattern`).
- **Module boundary:** скрипт зависит от `src/apply/preview/tochka.ts` и `src/config.ts` только на чтение (резолв/резолвер); мутация конфига остаётся в скрипте. Рантайм не знает про скрипт.
- **Style/lint:** новые импорты и изменения проходят Biome; `npm run check` — часть DoD.

## Риски

- **tsx на CI/пользователе:** `map:tochka` теперь требует `tsx`; он уже dev-зависимость, дополнительная установка не нужна.
- **Расхождение resolved/raw при записи:** запись правил не использует резолвнутую форму, поэтому риск порчи формата отсутствует; резолв используется только для решения «переспрашивать или нет».
