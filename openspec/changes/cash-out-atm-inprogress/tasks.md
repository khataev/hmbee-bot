## 1. Документация

- [x] 1.1 Обновить `TRANSACTION-RULES.md`: строку «Снятие наличных в банкомате» в таблице Точка — расширить условие `included` на `status in {Withdraw, InProgress}`, обновить примечание.
- [x] 1.2 Обновить примечание «Вне скоупа снятия наличных»: убрать холд (`CashOutAtm` в статусе `InProgress`) из списка нерешённых кейсов, явно описать остаточный риск дублирования (см. `design.md` — Risks / Trade-offs) как известное и осознанно принятое ограничение.

## 2. Конфигурация

- [ ] 2.1 В `config/sources.json` расширить `included`-условие `CashOutAtm` (тип `CardTransactionInfo`): матчить `status = Withdraw` ИЛИ `status = InProgress` (по образцу существующей OR-ветки для `Purchase`).
- [ ] 2.2 Синхронно применить то же изменение в `config/sources.example.json`.

## 3. Тесты

- [ ] 3.1 Добавить фикстуру `src/apply/preview/fixtures/card-transaction-cash-out-atm-inprogress.json` — `CashOutAtm` со `status = InProgress` (по образцу `card-transaction-cash-out-atm.json`).
- [ ] 3.2 Добавить тест-кейс в `src/apply/preview-CardTransactionInfo.test.ts`, ожидающий `identified = true`, `save = true`, `reason = null`, `normalized.type = transfer`, корректный `counterpartyAccountId` (cash-кошелёк) — симметрично существующему `Withdraw`-кейсу.
- [ ] 3.3 Прогнать `npm run check` (lint + typecheck + тесты) и убедиться, что все тесты, включая новый и существующие `CardTransactionInfo`-кейсы, проходят.
