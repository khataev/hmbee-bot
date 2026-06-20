## Why

После `match-planned-transactions` запись, сматченная с неподтверждённым планом, формирует confirm-черновик `hmbee` (с `id` плана), но раннер его **не отправляет** — отправка была осознанно отложена. Этот change снимает отсрочку: `apply` реально подтверждает план в Хани Мани (POST с `id`), вместо того чтобы держать запись или плодить дубль. Формат тела подтверждён ручным спайком на реальном API.

## What Changes

- `apply` (без preview) отправляет **confirm-черновики** (`hmbee.id != null`) тем же эндпоинтом `POST /transaction`, что и create.
- Тело подтверждения — **лин-форма** `HoneyMoneyTransaction`: эхо-им из плана `id`, `type=planned`, `plan_amount`, `common_id`, `virtual_id`, `planned_repeat_days/end/end_date`; впрыскиваем `real_amount` (сумма банка) и `date` (дата банка); `description` строим из маппинга, как у create.
- Серверные поля **не отправляются** (`user_id`, `created_from`, `created_at`, `updated_at`, `planned_repeat_end_times`) — спайк показал, что сервер ведёт их сам.
- Кеш Хани Мани начинает хранить поля повтора (`planned_repeat_days`, `planned_repeat_end`, `planned_repeat_end_date`), чтобы их можно было эхо-ить при подтверждении.
- Confirm-типы: поля повтора становятся реальными значениями вместо литералов; `common_id: string | null`.
- Клиент получает отправку confirm и парсер ответа confirm-формы.
- Модификатор `apply --one-by-one`: транзакции (и create, и confirm) отправляются **по одной с ручным подтверждением** каждой. Нужен для отладки на первых порах — чтобы не залить всё сразу и при ошибке не вычищать записи из Хани Мани вручную.

## Capabilities

### New Capabilities
- `planned-transaction-confirmation`: построение и отправка подтверждения существующего плана (POST с `id`), включая эхо полей плана, впрыск `real_amount`/`date` и разбор ответа.

### Modified Capabilities
- `source-apply`: раннер записи теперь отправляет и create-, и confirm-черновики (снимается временная отсрочка confirm); добавляется модификатор `--one-by-one` с ручным подтверждением каждой отправки.
- `hmbee-transaction-cache`: кешируемая запись сохраняет поля повтора плана, необходимые для round-trip при подтверждении.

## Impact

- Код: [`src/hmbee/client.ts`](src/hmbee/client.ts) (схема кеша +repeat-поля, метод отправки confirm, парсер ответа), [`src/apply/preview/types.ts`](src/apply/preview/types.ts) (confirm-типы: repeat реальными, `common_id: string`), [`src/hmbee/plannedMatcher.ts`](src/hmbee/plannedMatcher.ts) (`buildConfirmHmbee` эхо из плана + `real_amount`/`date`), [`src/index.ts`](src/index.ts) (раннер отправляет confirm-черновики).
- Внешние вызовы: дополнительные `POST /transaction` с `id` (подтверждение планов).
- Интерактив: при `--one-by-one` раннер запрашивает подтверждение по каждой отправке через stdin (`src/index.ts`).
- Спайк выполнен вручную на тестовом рекуррентном плане (`id 2580985713`) — лин-боди принят, repeat-поля сохранены; результаты зафиксированы в design.
- Качество: Definition of Done — `npm run check` зелёный; новое покрыто unit-тестами (build confirm-тела, отправка по `id`, парсер ответа) в стиле существующих тестов.
