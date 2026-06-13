## 1. Honey Money client: fetch all transactions

- [ ] 1.1 Добавить в `HoneyMoneyClient` метод `getAllTransactions`: GET `all_json.json` с auth-заголовками `user-email`/`user-token`/`hm-source`/cookie из env
- [ ] 1.2 Описать Zod-схему ответа и нормализовать его в список через `Object.values`
- [ ] 1.3 Бросать понятную ошибку при не-success HTTP, без раскрытия секретов
- [ ] 1.4 Тесты: успешный парс ответа и ошибка без секретов

## 2. Honey Money cache: trim & write

- [ ] 2.1 Модуль кеша: обрезка записей по `date >= (from − 10 дней)` (учесть фолбэк даты карт `meta_data.time_data.event_date`)
- [ ] 2.2 Запись в `sync/hmbee/all_json_cache.json` с созданием каталога `sync/hmbee/` при отсутствии и overwrite при каждом обновлении
- [ ] 2.3 Тесты: граница обрезки (включительно `from − 10д`), создание каталога, перезапись

## 3. Sync command flag

- [ ] 3.1 Добавить флаг `--update-hmbee-cache` к команде `sync` в `src/index.ts`
- [ ] 3.2 При флаге: после обычной синхронизации источника вызвать выгрузку + обрезку + запись кеша, используя `--from` как границу
- [ ] 3.3 Без флага — поведение `sync` не меняется (Хани Мани не запрашивается, кеш не трогается)
- [ ] 3.4 Тест/проверка: запуск с флагом обновляет кеш, без флага — нет

## 4. Manual-entry skip index & matching

- [ ] 4.1 Загрузка кеша `sync/hmbee/all_json_cache.json` в `apply` (поведение при отсутствии файла — по решению в design Open Questions)
- [ ] 4.2 Построить индекс «реально внесённых»: записи с `real_amount != null` (unplanned ∪ confirmed-planned), исключить планы только с `plan_amount`
- [ ] 4.3 Реализовать ключ сопоставления `account_id + date + round(amount) + direction + category`; для `subtype=t` исключить категорию; включить валюту
- [ ] 4.4 Нормализация перед сравнением: `Math.round` суммы и фолбэк даты карт
- [ ] 4.5 Жадный 1:1: индекс как `Map<key, list>`, изъятие записи при матче
- [ ] 4.6 Тесты: income/expense по полному ключу, transfer без категории, нормализация суммы/даты, 1:1 при двух одинаковых суммах за день

## 5. Wire skip into apply

- [ ] 5.1 Пост-проход в `apply`: при матче ставить `identified=true, save=false, reason="Внесена вручную"`; при отсутствии — не менять запись
- [ ] 5.2 Убедиться, что skip-записи не уходят в write-path (через существующий `save=false`) и видны в `--preview`
- [ ] 5.3 (verbose) Печать сводки пропущенных и возраста/даты кеша
- [ ] 5.4 Тесты: skip помечается и не пишется; не-матч остаётся writable; запись видна в preview

## 6. Quality gate

- [ ] 6.1 Прогнать `npm run check` (Biome lint+format, TypeScript strict, тесты) до зелёного
- [ ] 6.2 Обновить документацию при необходимости (README/TRANSACTION-RULES) по новому флагу и skip-поведению
