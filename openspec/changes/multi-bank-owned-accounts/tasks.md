## 1. Схема конфига

- [ ] 1.1 В `src/config.ts` извлечь общий `BankConfigSchema` (bankBic optional, hmAccounts, accountMappings, typeCodes optional) на основе текущего `TochkaConfigSchema`
- [ ] 1.2 Заменить `AppConfigSchema.sources` на `z.record(z.string(), BankConfigSchema)` с обязательным ключом `tochka` (через `.refine` или явную проверку наличия `tochka`)
- [ ] 1.3 Аналогично обновить `ResolvedAppConfigSchema.sources` до record-формы; resolved `tochka` сохраняет `bankBic` и `typeCodes`
- [ ] 1.4 Обновить экспортируемые типы (`AppConfig` и связанные), убедиться что `config.sources.tochka` остаётся доступен

## 2. loadConfig: объединённая карта счетов

- [ ] 2.1 В `loadConfig` пройти по всем банкам `sources` и для каждого резолвить `accountMappings` против `hmAccounts` того же банка (ключ → id)
- [ ] 2.2 Слить результаты в единую карту `Record<string, number>` (accountNumber → hmId)
- [ ] 2.3 Добавить fail-fast при коллизии: один номер счёта мапится на разные hmId в разных банках — бросить ошибку с указанием номера (по образцу проверки депозитов на строках 119-123)
- [ ] 2.4 Сохранить объединённую карту в resolved-конфиг так, чтобы её получали и `createAccountRegistry`, и существующая non-transfer ветка нормализации

## 3. createAccountRegistry над объединённой картой

- [ ] 3.1 Перевести `createAccountRegistry` на объединённую карту вместо `config.sources.tochka.accountMappings`
- [ ] 3.2 `isOwned`: проверять наличие счёта в объединённой карте (плюс существующая ветка `isDeposit`, без изменений)
- [ ] 3.3 `getHmAccountId`: резолвить из объединённой карты (плюс существующая ветка `421*`-депозитов, без изменений)
- [ ] 3.4 Убедиться, что `isDeposit` и депозитная эвристика по-прежнему завязаны только на `tochka.bankBic`

## 4. Согласование вызовов

- [ ] 4.1 Прогнать `tsc`/`npm run check` и поправить все обращения к `config.sources.*`, переставшие типизироваться
- [ ] 4.2 Проверить, что `src/apply/preview/tochka.ts` не требует изменений (опирается на реестр); при необходимости — минимальная правка

## 5. Конфиг и фикстуры

- [ ] 5.1 Обновить `config/sources.example.json` под многобанковый формат с примерами `sber`/`tinkoff`
- [ ] 5.2 Добавить фикстуру кросс-банковского SBP-перевода (Точка → Т-Банк) в `src/apply/preview/fixtures/`

## 6. Тесты

- [ ] 6.1 Добавить тест: `SbpB2CPayment` Точка → Т-Банк даёт `normalized.type = transfer`, заполненный `counterpartyAccountId`, корректные `transfer_from_id`/`transfer_to_id`
- [ ] 6.2 Добавить тест: исходящий SBP на счёт, отсутствующий во всех банках, остаётся `expense`
- [ ] 6.3 Добавить тест загрузки конфига: коллизия номера счёта между банками → ошибка
- [ ] 6.4 Прогнать весь `src/apply/preview-*.test.ts` — убедиться в отсутствии регрессий (`PaymentIncome`/`PaymentAccepted` с `OWNED_PAYER`/`OWNED_PAYEE`)

## 7. Документация

- [ ] 7.1 Обновить `TRANSACTION-RULES.md`: «общий список моих счетов» охватывает все настроенные банки
- [ ] 7.2 Финальный прогон `npm run check` — зелёный
