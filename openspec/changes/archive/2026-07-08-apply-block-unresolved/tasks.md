## 1. Классификатор проблемных записей

- [x] 1.1 Ввести константу `EXPECTED_SKIP_REASONS = { "excluded", "Внесена вручную" }` (переиспользовать существующие строки: `MISSING_CATEGORY_REASON` из `tochka.ts` — как пример проблемного reason; «Внесена вручную» из `skipIndex.ts`)
- [x] 1.2 Реализовать чистую функцию над `PreviewRecord[]`, возвращающую список проблемных записей по правилу `!identified || (!save && reason ∉ EXPECTED_SKIP_REASONS)`

## 2. Гейтинг в apply

- [x] 2.1 В non-preview ветке `apply` в `src/index.ts` после построения `previewRecords` и до отправки вызвать классификатор
- [x] 2.2 При непустом списке проблемных — напечатать их (transactionId, описание, reason) в stderr и завершить с ненулевым exit code, не вызывая `dispatchTransaction`
- [x] 2.3 Убедиться, что `--preview` и `--preview-planned` не затрагиваются гейтингом
- [x] 2.4 Гейтинг оценивает полный нормализованный набор независимо от `--only-id`

## 3. Тесты

- [x] 3.1 Юнит-тесты классификатора: по одной проверке на каждую строку таксономии (identified=false; Category missing; excluded → не блокирует; Внесена вручную → не блокирует; save-ready → не блокирует)
- [x] 3.2 Тест: при наличии проблемной записи отправка (`dispatchTransaction`/create) не вызывается
- [x] 3.3 Тест: при отсутствии проблемных записей apply отправляет как прежде

## 4. Quality gate

- [x] 4.1 Прогнать `npm run check` (typecheck + Biome lint + vitest)
- [x] 4.2 Проверить вручную на `sync/tochka/*.json`: при наличии записи с отсутствующей категорией `apply tochka` падает со списком и ничего не отправляет
- [x] 4.3 Свериться со STYLE-GUIDE.md
- [x] 4.4 Провести ревью через `/opsx:review`, результат — в `openspec/changes/apply-block-unresolved/review.md`
