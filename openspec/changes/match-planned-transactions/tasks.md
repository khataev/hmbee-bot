## 1. Контракт PreviewRecord и hmbee

- [x] 1.1 Добавить в `PreviewRecord` поле `plannedMatchStatus?: MatchStatus` (без отдельного объекта матчинга)
- [x] 1.2 Ввести тип `MatchStatus`: `matched-exact` | `matched-tolerance` | `no-candidate` | `out-of-tolerance` | `ambiguous`
- [x] 1.3 Расширить `HoneyMoneyTransaction` confirm-вариантом: `id:number`, `type:'planned'`, `plan_amount`, `common_id`, `virtual_id` (create-вариант остаётся с `id:null`)

## 2. Срез кандидатов из кеша

- [x] 2.1 Построить срез «неподтверждённые планы»: `type=planned`, `plan_amount != null`, `real_amount == null`
- [x] 2.2 Индексировать по `account_id + direction + category` (для transfer — без category), учитывать календарный месяц
- [x] 2.3 Тесты: в срез попадают только неподтверждённые планы; confirmed и unplanned исключены

## 3. Дефолтный матчер

- [ ] 3.1 Ключ матча: account + direction + category + сумма ±20% (round), окно = календарный месяц транзакции
- [ ] 3.2 Для transfer исключить category из ключа
- [ ] 3.3 Уникальность 1:1 с «съеданием» плана; tie-break: ближайший по дате, затем по сумме
- [ ] 3.4 Проставление статуса: matched-exact / matched-tolerance / out-of-tolerance / no-candidate / ambiguous
- [ ] 3.5 Тесты: exact, ±20% граница, вне допуска, неверное направление, transfer без категории, 1:1 на двух кандидатах, ambiguous

## 4. Встраивание в пайплайн apply/preview

- [ ] 4.1 Вызвать матчер после стадии skip (порядок: skip → match → create), переиспользуя загруженный кеш
- [ ] 4.2 При матче: `identified=true, save=true, reason=null`, `hmbee` = confirm-форма (id плана, real_amount=сумма банка, date=дата факта), `plannedMatchStatus` = matched-*
- [ ] 4.3 Без матча: запись сохраняет create-черновик (`id=null`), `save=true`; проставить `plannedMatchStatus` (no-candidate/out-of-tolerance/ambiguous)
- [ ] 4.4 Гард раннера: `apply` (без preview) отправляет только create-черновики (`hmbee.id == null`); confirm-черновики (`id != null`) не шлёт
- [ ] 4.5 (verbose) Печать количества отложенных confirm-черновиков
- [ ] 4.6 Тесты: confirm-черновик не уходит в запись; create остаётся writable; порядок стадий корректен

## 5. Фильтр --preview-planned

- [ ] 5.1 Добавить флаг `--preview-planned` к команде `apply` в `src/index.ts`
- [ ] 5.2 Вывод: записи с `plannedMatchStatus` ≠ `no-candidate` (matched + кандидаты out-of-tolerance/ambiguous) + несматченные планы источника за период
- [ ] 5.3 Несматченные планы брать из среза кандидатов кеша на HM-счетах источника, не «съеденных» матчем
- [ ] 5.4 Показать сматченный план и `plannedMatchStatus`
- [ ] 5.5 Тесты: no-candidate исключены; кандидаты и несматченные планы показаны; пустой вывод когда нечего показывать

## 6. Quality gate

- [ ] 6.1 `npm run check` (Biome lint+format, TypeScript strict, тесты) до зелёного
- [ ] 6.2 Обновить документацию при необходимости (README/TRANSACTION-RULES) по матчингу планов и `--preview-planned`
