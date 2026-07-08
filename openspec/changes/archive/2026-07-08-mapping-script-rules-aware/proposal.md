## Why

Два дефекта интерактивного скрипта `scripts/tochka-mapping.js` (`npm run map:tochka`), обнаруженные при разборе транзакций из `sync/tochka/2026-06-22_2026-07-06.json`:

1. **Скрипт генерирует битые правила по regex-спецсимволам.** `buildRule` всегда оборачивает значение поля в `matches`, который в рантайме компилируется как `new RegExp(pattern, 'i')`. Для телефонов вида `+79604000382` ведущий `+` делает выражение невалидным (`SyntaxError: Nothing to repeat`), а `evaluateRule` молча возвращает `false` — правило никогда не срабатывает, транзакция остаётся без категории и не отправляется в Honey Money. Ровно так родились три нерабочих телефонных правила в `config/sources.json`. Для `title`-паттернов скрипт уже валидирует regex (`validateAndGetPattern`), а для правил — нет.

2. **Скрипт не учитывает секцию `rules` при авто-пропуске.** `alreadyMapped` проверяет только `mcc` и `title`, дублируя подмножество рантаймовой логики `mapTochkaCategory` и не воспроизводя ветку `rules`. В результате скрипт переспрашивает уже покрытые правилами транзакции (`PaymentClaim` по `purpose`, `SbpB2CPayment` по `phoneNumber` и т.д.). Родительский change `tochka-mapping-script-rules` пометил это как осознанное временное ограничение — теперь снимаем его.

## What Changes

- **Пункт 3 (учёт `rules`):** заменить рукодельный `alreadyMapped` (`mcc || title`) на переиспользование рантаймового резолвера `mapTochkaCategory`. Запись считается покрытой (`alreadyMapped = true`), если `mapTochkaCategory(record, getDescription(record), getMcc(record), categoryMapping, accountRegistry)` возвращает не `null`. Это бесплатно даёт учёт слоя `rules`, правильный приоритет `rules → title → mcc` и нюанс `purpose` для `PaymentClaim`, устраняя дрейф между скриптом и рантаймом.
- **Основной код:** только добавить `export` к трём существующим функциям в `src/apply/preview/tochka.ts` — `mapTochkaCategory`, `getDescription`, `getMcc`. **Сигнатуры не меняются, код не выносится.**
- **Запуск скрипта:** перевести `npm run map:tochka` на `tsx` (как `npm run dev`), чтобы скрипт мог импортировать `.ts`-модули по алиасу `src/*`. Скрипт использует `loadConfig()`/`createAccountRegistry()` для получения резолвнутого `CategoryMapping` и продолжает read-modify-write сырого JSON для записи правил.
- **Пункт 1 (валидация паттерна при генерации правила):** в rule-пути (`buildRule`/`handleRuleCommand`) проверять, является ли значение поля валидным self-matching regex (та же проверка, что в `validateAndGetPattern`). Если нет — печатать уведомление и **автоматически строить условие `==` вместо `matches`** (точное сравнение поля со значением). При валидном regex поведение прежнее (`matches`).

Не в объёме (out-of-scope):
- Рантаймовое поведение `matches`/`evaluateRule` не меняется (некорректный паттерн по-прежнему = несовпадение без выброса). Лечим источник — генерацию правил в скрипте.
- Существующие битые правила в `config/sources.json` оператор уже исправил вручную; массовая миграция конфига не входит в объём.
- Запись правил по-прежнему только в `config/sources.json`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `tochka-category-mapping`: (1) авто-пропуск скрипта теперь учитывает `rules` через переиспользование рантаймового `mapTochkaCategory` (отменяет прежнее ограничение); (2) команда `r` при невалидном regex-значении поля строит условие `==` вместо `matches` и уведомляет оператора.

## Impact

- `src/apply/preview/tochka.ts`: добавляется `export` к `mapTochkaCategory`, `getDescription`, `getMcc` (без изменения сигнатур и логики).
- `scripts/tochka-mapping.js`: `alreadyMapped` через `mapTochkaCategory`; импорт `loadConfig`/`createAccountRegistry`; валидация regex + авто-`==` в rule-пути.
- `package.json`: `map:tochka` переключается на `tsx`.
- Зависимости: без новых пакетов (`tsx` уже используется в `dev`).
- Quality gate: `npm run check` (typecheck + Biome lint + vitest) должен проходить.
