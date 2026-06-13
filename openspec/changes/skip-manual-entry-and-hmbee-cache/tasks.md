## 1. Honey Money client: fetch all transactions

- [x] 1.1 Добавить в `HoneyMoneyClient` метод `getAllTransactions`: GET `all_json.json` с auth-заголовками `user-email`/`user-token`/`hm-source`/cookie из env
- [x] 1.2 Описать Zod-схему ответа и нормализовать его в список через `Object.values`
- [x] 1.3 Бросать понятную ошибку при не-success HTTP, без раскрытия секретов
- [x] 1.4 Тесты: успешный парс ответа

## 2. Honey Money cache: trim & write

- [x] 2.1 Модуль кеша: обрезка записей по `date >= (from − 10 дней)` (учесть фолбэк даты карт `meta_data.time_data.event_date`)
- [x] 2.2 Запись в `sync/hmbee/all_json_cache.json` с созданием каталога `sync/hmbee/` при отсутствии и overwrite при каждом обновлении
- [x] 2.3 Тесты: граница обрезки (включительно `from − 10д`), создание каталога, перезапись

## 3. Sync command flag

- [x] 3.1 Добавить флаг `--update-hmbee-cache` к команде `sync` в `src/index.ts`
- [x] 3.2 При флаге: после обычной синхронизации источника вызвать выгрузку + обрезку + запись кеша, используя `--from` как границу
- [x] 3.3 Без флага — поведение `sync` не меняется (Хани Мани не запрашивается, кеш не трогается)
- [x] 3.4 Тест/проверка: запуск с флагом обновляет кеш, без флага — нет

## 4. Manual-entry skip index & matching

- [x] 4.1 Загрузка кеша `sync/hmbee/all_json_cache.json` в `apply`; при отсутствии файла — жёсткая ошибка с подсказкой `sync --update-hmbee-cache`
- [x] 4.2 Построить индекс «реально внесённых»: записи с `real_amount != null` (unplanned ∪ confirmed-planned), исключить планы только с `plan_amount`
- [x] 4.3 Реализовать ключ сопоставления `account_id + date + round(amount) + direction + category`; для `subtype=t` исключить категорию; включить валюту
- [x] 4.4 Нормализация перед сравнением: `Math.round` суммы и фолбэк даты карт
- [x] 4.5 Жадный 1:1: индекс как `Map<key, list>`, изъятие записи при матче
- [x] 4.6 Тесты: income/expense по полному ключу, transfer без категории, нормализация суммы/даты, 1:1 при двух одинаковых суммах за день

## 5. Wire skip into apply

- [x] 5.1 Пост-проход в `apply`: при матче ставить `identified=true, save=false, reason="Внесена вручную"`; при отсутствии — не менять запись
- [x] 5.2 Убедиться, что skip-записи не уходят в write-path (через существующий `save=false`) и видны в `--preview`
- [x] 5.3 (verbose) Печать сводки пропущенных и возраста/даты кеша
- [x] 5.4 Тесты: skip помечается и не пишется; не-матч остаётся writable; запись видна в preview

## 6. Quality gate

- [x] 6.1 Прогнать `npm run check` (Biome lint+format, TypeScript strict, тесты) до зелёного
- [x] 6.2 Обновить документацию при необходимости (README/TRANSACTION-RULES) по новому флагу и skip-поведению
