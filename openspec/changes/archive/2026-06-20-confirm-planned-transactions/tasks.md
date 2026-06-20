## 1. Read-схема кеша: поля повтора

- [x] 1.1 Добавить в `HoneyMoneyCacheEntrySchema` поля `planned_repeat_days`, `planned_repeat_end`, `planned_repeat_end_date` (nullable/optional)
- [x] 1.2 Убедиться, что `UnconfirmedPlannedTxn`/индекс планов несут эти поля
- [x] 1.3 Тест: поля повтора переживают парсинг и попадают в кандидата
- [x] 1.4 Уточнить типы в `HoneyMoneyCacheEntrySchema` по анализу истории: `common_id` → только `string` (nullable/optional), `virtual_id` → только `number` (nullable/optional) — вместо текущего `z.union([number, string])`

## 2. Confirm-типы

- [x] 2.1 `HoneyMoneyConfirm*`: `planned_repeat_days/end/end_date` — реальные типы (`number`/`string`/`string|null`) вместо литералов
- [x] 2.2 `common_id: string | null` в confirm-типах
- [x] 2.3 Проверить, что `buildConfirmHmbee` типизируется без ошибок (string common_id из кеша)

## 3. buildConfirmHmbee: эхо из плана

- [x] 3.1 Эхо-ить из плана `id`, `type=planned`, `plan_amount`, `common_id`, `virtual_id`, `planned_repeat_days/end/end_date`
- [x] 3.2 Впрыснуть `real_amount` (сумма банка) и `date` (дата банка)
- [x] 3.3 `description` — из create-черновика (маппинг), серверные поля не добавлять
- [x] 3.4 Тесты: собранное тело = лин-форма, repeat из плана, real_amount/date из банка

## 4. Клиент: отправка confirm

- [x] 4.1 Метод отправки confirm: `POST /transaction` с телом (`id != null`), те же auth-заголовки
- [x] 4.2 Парсер ответа confirm-формы → `data.transaction.id`, проверка `status: "success"`
- [x] 4.3 Ошибка при не-success без раскрытия секретов
- [x] 4.4 Тесты: успешный парс id, ошибка без секретов

## 5. Раннер: отправлять confirm-черновики

- [x] 5.1 Снять гард «только create»; маршрутизировать по `hmbee.id`: null → create, иначе → confirm
- [x] 5.2 (verbose) Печать счётчиков созданных и подтверждённых
- [x] 5.3 Тесты: confirm-черновик уходит в confirm-путь; create — в create-путь

## 6. Режим --one-by-one

- [x] 6.1 Добавить флаг `--one-by-one` к команде `apply`
- [x] 6.2 Перед каждой отправкой печатать ОДНОСТРОЧНУЮ сводку: `дата · subtype(e/i/t) · категория · description` (из `hmbee`) + пометка create/confirm (для confirm — id плана); затем спрашивать через stdin: `y` отправить / `n` пропустить / `q` выйти (опц. `a` — все оставшиеся)
- [x] 6.3 Инертность в `--preview`/`--preview-planned` (нет записи — нет промптов)
- [x] 6.4 Тест: ветвление prompt → отправка/пропуск/выход (мок stdin и клиента)

## 7. Quality gate

- [x] 7.1 `npm run check` (typecheck + biome + тесты) до зелёного
- [x] 7.2 Обновить README по подтверждению планов и `--one-by-one` в `apply`
- [x] 7.3 На первом реальном прогоне проверить сдвиг даты у рекуррентного инстанса (не ломает серию)
