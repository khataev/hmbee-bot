## 1. Модель данных PlanMatch

- [x] 1.1 В `src/apply/preview/types.ts` добавить `'beaten-match'` в union `MatchStatus`
- [x] 1.2 Объявить интерфейс `PlanMatch { status: MatchStatus; lostPlanId?: number; beatenById?: string }` рядом с `PreviewRecord`
- [x] 1.3 Заменить `PreviewRecord.plannedMatchStatus?: MatchStatus` на `planMatch?: PlanMatch`

## 2. Бакетное разрешение в plannedMatcher

- [ ] 2.1 В `src/hmbee/plannedMatcher.ts` добавить группировку matchable-записей по ключу бакета (`account_id|subtype|category|yearMonth`) в Фазе 1
- [ ] 2.2 Реализовать разрешение бакета: построить рёбра real↔plan (план в допуске через `isWithinTolerance`), вес = дистанция по сумме, затем дате
- [ ] 2.3 Реализовать жадный разбор: глобально минимальное ребро → consume(real, plan) → повтор, пока есть рёбра среди свободных концов; переиспользовать логику тай-брейка из `selectBest`
- [ ] 2.4 Детектировать `ambiguous` как ничью по минимальной дистанции на общем конце (реальная между двумя планами ИЛИ план между двумя реальными)
- [ ] 2.5 Выставлять `beaten-match` с `lostPlanId` (оспоренный план) и `beatenById` (`normalized.transactionId` победителя) для реальной, проигравшей единственный достижимый план
- [ ] 2.6 Переписать `applyMatchPass` на трёхфазную схему (собрать → разрешить по бакетам → записать `planMatch` обратно), убрав потоковую splice-мутацию индекса
- [ ] 2.7 Сохранить формирование confirm-черновика (`buildConfirmHmbee`) и статусы `matched-exact`/`matched-tolerance`/`no-candidate`/`out-of-tolerance` без изменения семантики

## 3. Индекс и planned-view

- [ ] 3.1 В `src/hmbee/plannedIndex.ts` обеспечить корректный учёт потреблённых планов при бакетном разрешении (`collectUnmatchedPlans` возвращает только непотреблённые)
- [ ] 3.2 В `src/hmbee/previewPlanned.ts` переключить `selectPlanRelevantRecords` на `record.planMatch?.status`
- [ ] 3.3 Убедиться, что `beaten-match` попадает в planned-view, а `no-candidate` и записи без `planMatch` — исключаются

## 4. Тесты

- [ ] 4.1 Тест на репортнутый баг: точная реальная (дистанция 0) выигрывает план у более ранней по файлу разовой; разовая получает `beaten-match`
- [ ] 4.2 Тест на независимость результата от порядка записей в файле (перестановка входа даёт тот же исход)
- [ ] 4.3 Тест симметричного `ambiguous`: две одинаковые реальные за один план, и одна реальная между двумя одинаковыми планами
- [ ] 4.4 Тест заполнения `lostPlanId`/`beatenById` при `beaten-match` и их отсутствия при остальных статусах
- [ ] 4.5 Регрессионный тест: одиночный бакет (N=1) даёт прежнее поведение и статусы
- [ ] 4.6 Обновить существующие `plannedMatcher.test.ts` и `plannedIndex.test.ts` под поле `planMatch`

## 5. Качество и приёмка

- [ ] 5.1 Прогнать `npm run check` (Biome lint+format + TypeScript strict) — без ошибок
- [ ] 5.2 Сверить код со STYLE-GUIDE.md и TRANSACTION-RULES.md
- [ ] 5.3 Пройти код-ревью через `/opsx:review`, зафиксировать результат в `openspec/changes/fix-planned-match-greedy/review.md`
