## 1. Read-схема кеша: поля повтора

- [x] 1.1 Добавить в `HoneyMoneyCacheEntrySchema` поля `planned_repeat_days`, `planned_repeat_end`, `planned_repeat_end_date` (nullable/optional)
- [x] 1.2 Убедиться, что `UnconfirmedPlannedTxn`/индекс планов несут эти поля
- [x] 1.3 Тест: поля повтора переживают парсинг и попадают в кандидата

## 2. Confirm-типы

- [ ] 2.1 `HoneyMoneyConfirm*`: `planned_repeat_days/end/end_date` — реальные типы (`number`/`string`/`string|null`) вместо литералов
- [ ] 2.2 `common_id: string | null` в confirm-типах
- [ ] 2.3 Проверить, что `buildConfirmHmbee` типизируется без ошибок (string common_id из кеша)

## 3. buildConfirmHmbee: эхо из плана

- [ ] 3.1 Эхо-ить из плана `id`, `type=planned`, `plan_amount`, `common_id`, `virtual_id`, `planned_repeat_days/end/end_date`
- [ ] 3.2 Впрыснуть `real_amount` (сумма банка) и `date` (дата банка)
- [ ] 3.3 `description` — из create-черновика (маппинг), серверные поля не добавлять
- [ ] 3.4 Тесты: собранное тело = лин-форма, repeat из плана, real_amount/date из банка

## 4. Клиент: отправка confirm

- [ ] 4.1 Метод отправки confirm: `POST /transaction` с телом (`id != null`), те же auth-заголовки
- [ ] 4.2 Парсер ответа confirm-формы → `data.transaction.id`, проверка `status: "success"`
- [ ] 4.3 Ошибка при не-success без раскрытия секретов
- [ ] 4.4 Тесты: успешный парс id, ошибка без секретов

## 5. Раннер: отправлять confirm-черновики

- [ ] 5.1 Снять гард «только create»; маршрутизировать по `hmbee.id`: null → create, иначе → confirm
- [ ] 5.2 (verbose) Печать счётчиков созданных и подтверждённых
- [ ] 5.3 Тесты: confirm-черновик уходит в confirm-путь; create — в create-путь

## 6. Режим --one-by-one

- [ ] 6.1 Добавить флаг `--one-by-one` к команде `apply`
- [ ] 6.2 Перед каждой отправкой печатать ОДНОСТРОЧНУЮ сводку: `дата · subtype(e/i/t) · категория · description` (из `hmbee`) + пометка create/confirm (для confirm — id плана); затем спрашивать через stdin: `y` отправить / `n` пропустить / `q` выйти (опц. `a` — все оставшиеся)
- [ ] 6.3 Инертность в `--preview`/`--preview-planned` (нет записи — нет промптов)
- [ ] 6.4 Тест: ветвление prompt → отправка/пропуск/выход (мок stdin и клиента)

## 7. Quality gate

- [ ] 7.1 `npm run check` (typecheck + biome + тесты) до зелёного
- [ ] 7.2 Обновить README по подтверждению планов и `--one-by-one` в `apply`
- [ ] 7.3 На первом реальном прогоне проверить сдвиг даты у рекуррентного инстанса (не ломает серию)
