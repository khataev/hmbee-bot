## 1. Конфигурация счёта кошелька

- [ ] 1.1 Добавить в `config/sources.json` источник `cash` с `hmAccounts.cash-wallet-rub` (`id: 5695`, `name: "Кошелек"`, `currency: "rub"`) и `accountMappings` `{"cash:rub": "cash-wallet-rub"}`
- [ ] 1.2 Добавить тот же источник в `config/sources.example.json` с обезличенным `id` — файл трекается в git, реальный `id` в него не попадает
- [ ] 1.3 Добавить в `config/sources.json` ветку `included` для `CardTransactionInfo`: `tranCode = CashOutAtm` И `status = Withdraw`; `excluded` не трогать
- [ ] 1.4 Зеркально добавить ту же ветку `included` в `config/sources.example.json`
- [ ] 1.5 Проверить, что `loadConfig()` принимает конфиг без правок схемы: запустить `npm run check` и убедиться, что existing config-тесты (`src/config.test.ts`) зелёные

## 2. Классификация снятия наличных

- [ ] 2.1 В `src/apply/preview/tochka.ts` добавить module-private type guard `isCashOutAtmRecord(record): record is CardTransactionInfoRecord` = `isCardTransactionInfoRecord(record) && record.data.tranCode === 'CashOutAtm'`; поставить рядом с остальными `isXxxRecord`
- [ ] 2.2 В `getNormalizedType` добавить для карточных записей ветку `isCashOutAtmRecord` → `transfer`, выше существующей `ReverseByCard`/`expense` строки
- [ ] 2.3 В `getCounterpartyAccount` вернуть для `isCashOutAtmRecord` синтетический ключ `cash:${record.data.currency.toLowerCase()}`; для остальных карточных записей поведение не менять
- [ ] 2.4 Расширить guard transfer-ветки: `if (!isBankPaymentRecord(sourceRecord) && !isCashOutAtmRecord(sourceRecord)) throw`, текст сообщения обновить на «bank payment record or an ATM cash withdrawal»
- [ ] 2.5 Заменить два `getHmAccountId(...)` на тернарники по `isBankPaymentRecord`: банковская запись → `payerAccountId`/`payeeAccountId` **дословно как сейчас**, иначе → `normalized.account` / `counterpartyAccountId` (снятие всегда исходящее). Сообщения об ошибке обобщить с `payer`/`payee` на `from`/`to`
- [ ] 2.6 Захватить `normalized.counterpartyAccountId` в локальную константу до проверки инварианта — TypeScript не сужает тип свойства после `throw`, а `as string` использовать нельзя
- [ ] 2.7 Запустить `npm run check`; существующие transfer-тесты (`preview-PaymentAccepted`, `preview-PaymentIncome`, `preview-PaymentWrittenOff`, `preview-SbpB2CPayment`, `preview-SbpC2CPayment`) должны быть зелёными **без единой правки** — если правка понадобилась, банковская ветка поехала

## 3. Фикстура и тесты

- [ ] 3.1 Создать фикстуру `src/apply/preview/fixtures/card-transaction-cash-out-atm.json` на основе реальной записи из `sync/tochka/2026-07-09_2026-07-23.json` (`tranId 4483988400`, `sum 9000`, `mcc 6011`) с маскировкой чувствительных полей по принятому в фикстурах образцу
- [ ] 3.2 Добавить в `src/apply/preview-CardTransactionInfo.test.ts` кейс: `CashOutAtm + Withdraw` → `identified = true`, `save = true`, `reason = null`, `normalized.type = 'transfer'`, `counterpartyAccountId = 'cash:rub'`
- [ ] 3.3 Добавить кейс на HM-транзакцию: `subtype = 't'`, `transfer_from_id` = HM-счёт карточного счёта, `transfer_to_id` = HM-счёт кошелька, `real_amount = 9000`, `transfer_to_amount = 9000`, `category = null`
- [ ] 3.4 Добавить кейс: `CashOutAtm` со статусом, отличным от `Withdraw` → `identified = false`, `reason = 'no matching included/excluded condition'`
- [ ] 3.5 Добавить кейс: `CashOutAtm` в валюте без настроенного кошелька → `identified = false`, `save = false`, `reason` называет неразрешённую ногу перевода
- [ ] 3.6 Запустить `npm run check` — typecheck, Biome и весь vitest-прогон должны быть зелёными

## 4. Проверка на реальных данных

- [ ] 4.1 Прогнать превью на `sync/tochka/2026-07-09_2026-07-23.json` и убедиться, что снятие 9000 ₽ от 2026-07-21 классифицировано как перевод `Точка ИП. РУБЛИ → Кошелек`
- [ ] 4.2 Сверить остальные 89 записей окна с классификацией до изменения — расхождений быть не должно

## 5. Документация

- [ ] 5.1 Добавить в `TRANSACTION-RULES.md` строку сценария «Снятие наличных в банкомате» в таблицу Точки: `type_code`, `included`/`excluded`, JSON logic, ссылки на тест и фикстуру
- [ ] 5.2 Дополнить раздел «Что сейчас особенно важно помнить» пунктом про счёт кошелька и синтетический ключ `cash:<валюта>`, включая отмеченные вне скоупа сценарии (внесение наличных, комиссия, СБП-снятие, статус холда)
- [ ] 5.3 Завести в `TECH-DEBT.md` запись: два тернарника по `isBankPaymentRecord` в transfer-ветке свернуть в `getTransferLegs`, когда появится третье семейство переводов (внесение наличных / СБП-снятие)
- [ ] 5.4 Финальный `npm run check` перед завершением изменения
