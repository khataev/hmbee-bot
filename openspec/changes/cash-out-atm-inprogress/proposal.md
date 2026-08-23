## Why

Точка присылает снятие наличных в банкомате (`CashOutAtm`) двумя стадиями: сначала холд `status = InProgress`, затем подтверждение `status = Withdraw`. Текущий `sources.json` матчит `included` только по `status = Withdraw`, поэтому холд не матчит ни `included`, ни `excluded` и падает с `identified = false`, `reason = "no matching included/excluded condition"` — на реальном синке (`tranId 4578588294`, 2026-08-22) сумма была видна пользователю как ошибка, хотя это обычное снятие наличных на стадии холда. `TRANSACTION-RULES.md` уже отмечал этот кейс как сознательно отложенный ("поведение холда данными не подтверждено") — теперь поведение подтверждено реальными данными: холд действительно приходит с тем же `tranCode = CashOutAtm` и корректными данными счёта/суммы/валюты, пригодными для классификации transfer уже на этой стадии.

## What Changes

- Расширить `included`-условие `CashOutAtm` в `config/sources.json` (и синхронно в `config/sources.example.json`): матчить `status = Withdraw` ИЛИ `status = InProgress`, по аналогии с тем, как для `Purchase` уже включены оба статуса.
- Обновить `TRANSACTION-RULES.md`: строку «Снятие наличных в банкомате» в таблице Точка и примечание про «вне скоупа снятия наличных», убрав холд из списка нерешённых кейсов и явно задокументировав остаточный риск дублирования (см. Impact).
- Добавить тест-кейс и фикстуру для `CashOutAtm` со `status = InProgress`, ожидающие `identified = true`, `save = true`, `normalized.type = transfer` (симметрично существующему `Withdraw`-кейсу).

## Capabilities

### New Capabilities
(нет)

### Modified Capabilities
- `tochka-transfer-preview`: требование «ATM cash withdrawal is classified as a save-ready transfer to the cash wallet» расширяется — сценарий классификации transfer теперь покрывает `status = Withdraw` ИЛИ `status = InProgress`; сценарий «`CashOutAtm` card transaction in any other status is not identified» сужается до статусов, отличных от `Withdraw` и `InProgress`.

## Impact

- Затронутый код: `config/sources.json`, `config/sources.example.json` (данные конфигурации, не логика `src/apply/preview/tochka.ts` — правило выражается через существующий JSON Logic `included`).
- Затронутые тесты: `src/apply/preview-CardTransactionInfo.test.ts`, новая фикстура в `src/apply/preview/fixtures/`.
- Затронутая документация: `TRANSACTION-RULES.md`.
- **Известный остаточный риск (не решается в рамках этого изменения):** дедуп в проекте (`src/hmbee/skipIndex.ts`, `applySkipPass`) сопоставляет записи не по `tranId` банка, а по fuzzy-ключу `(account_id, date, real_amount, subtype, category, currency)`. Если один и тот же `tranId` позже придёт вторым событием со `status = Withdraw`, и при этом `event_date` или сумма разойдутся с уже сохранённой `InProgress`-версией — в Honey Money может появиться дублирующийся перевод. Данных о том, действительно ли Точка присылает повторное событие с тем же `tranId` и как меняется `event_date` между стадиями холда и подтверждения, пока недостаточно; риск фиксируется как известный и требует наблюдения за следующими синками.
- Качество: `npm run check` (lint, typecheck, тесты) должен проходить; новый тест-кейс — часть Definition of Done.
