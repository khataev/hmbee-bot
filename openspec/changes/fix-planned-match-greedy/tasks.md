## 1. Модель данных PlanMatch

- [x] 1.1 В `src/apply/preview/types.ts` добавить `'beaten-match'` в union `MatchStatus`
- [x] 1.2 Объявить интерфейс `PlanMatch { status: MatchStatus; lostPlanId?: number; beatenById?: string }` рядом с `PreviewRecord`
- [x] 1.3 Заменить `PreviewRecord.plannedMatchStatus?: MatchStatus` на `planMatch?: PlanMatch`

## 2. Бакетное разрешение в plannedMatcher

- [x] 2.1 В `src/hmbee/plannedMatcher.ts` добавить группировку matchable-записей по ключу бакета (`account_id|subtype|category|yearMonth`) в Фазе 1
- [x] 2.2 Реализовать разрешение бакета: построить рёбра real↔plan (план в допуске через `isWithinTolerance`), вес = дистанция по сумме, затем дате
- [x] 2.3 Реализовать жадный разбор: глобально минимальное ребро → consume(real, plan) → повтор, пока есть рёбра среди свободных концов; переиспользовать логику тай-брейка из `selectBest`
- [x] 2.4 Детектировать `ambiguous` как ничью по минимальной дистанции на общем конце (реальная между двумя планами ИЛИ план между двумя реальными)
- [x] 2.5 Выставлять `beaten-match` с `lostPlanId` (оспоренный план) и `beatenById` (`normalized.transactionId` победителя) для реальной, проигравшей единственный достижимый план
- [x] 2.6 Переписать `applyMatchPass` на трёхфазную схему (собрать → разрешить по бакетам → записать `planMatch` обратно), убрав потоковую splice-мутацию индекса
- [x] 2.7 Сохранить формирование confirm-черновика (`buildConfirmHmbee`) и статусы `matched-exact`/`matched-tolerance`/`no-candidate`/`out-of-tolerance` без изменения семантики

## 3. Тесты бакетного разрешения

- [x] 3.1 Тест на репортнутый баг: точная реальная (дистанция 0) выигрывает план у более ранней по файлу разовой; разовая получает `beaten-match`
- [x] 3.2 Тест на независимость результата от порядка записей в файле (перестановка входа даёт тот же исход)
- [x] 3.3 Тест симметричного `ambiguous`: две одинаковые реальные за один план, и одна реальная между двумя одинаковыми планами
- [x] 3.4 Тест заполнения `lostPlanId`/`beatenById` при `beaten-match` и их отсутствия при остальных статусах
- [x] 3.5 Обновить существующие тесты `applyMatchPass` в `plannedMatcher.test.ts` под поле `planMatch`

## 4. Индекс и planned-view

- [x] 4.1 В `src/hmbee/plannedIndex.ts` обеспечить корректный учёт потреблённых планов при бакетном разрешении (`collectUnmatchedPlans` возвращает только непотреблённые)
- [x] 4.2 В `src/hmbee/previewPlanned.ts` переключить `selectPlanRelevantRecords` на `record.planMatch?.status`
- [x] 4.3 Убедиться, что `beaten-match` попадает в planned-view, а `no-candidate` и записи без `planMatch` — исключаются

## 5. Тесты

- [x] 5.1 Регрессионный тест: одиночный бакет (N=1) даёт прежнее поведение и статусы
- [x] 5.2 Обновить существующие `plannedIndex.test.ts` под поле `planMatch`

## 6. Рефакторинг нормализации сумм

`real_amount` и `plan_amount` из объектов HoneyMoney уже нормализованы: `buildHoneyMoneyTransferTransaction` всегда возвращает положительный `real_amount` (делает `abs`), `buildHoneyMoneyIncomeExpenseTransaction` делает `abs` и присваивает знак по типу операции. Внутри одного бакета (одинаковый `subtype`) оба значения гарантированно одного знака и целочисленные (без дробных копеек). Следствие: `Math.round` в `isWithinTolerance` / `selectBest` / `resolveBucket` избыточен, `Math.abs` на обоих слагаемых разности можно заменить одним `Math.abs` на разности.

- [x] 6.1 В `isWithinTolerance` убрать `Math.round` и упростить до `Math.abs(sourceAmount - planAmount) <= AMOUNT_MATCH_TOLERANCE * Math.abs(planAmount)`
- [x] 6.2 В `resolveBucket` упростить `amountDiff` до `Math.abs(entry.real_amount - plan.plan_amount)` и exact-match до `entry.real_amount === plan.plan_amount`; переименовать `BucketEntry.amount` → `BucketEntry.real_amount` с обновлением всех использований
- [x] 6.3 В `selectBest` — н/п: функция удалена вместе с `matchPlannedTransaction`
- [x] 6.4 В `matchPlannedTransaction` — н/п: функция удалена

## 7. Качество и приёмка

- [x] 7.1 Прогнать `npm run check` (Biome lint+format + TypeScript strict) — без ошибок
- [x] 7.2 Сверить код со STYLE-GUIDE.md и TRANSACTION-RULES.md
