## 1. Схема конфига

- [x] 1.1 В `src/config.ts` извлечь общий `BankConfigSchema` (bankBic optional, hmAccounts, accountMappings, typeCodes optional) на основе текущего `TochkaConfigSchema`
- [x] 1.2 Заменить `AppConfigSchema.sources` на `z.record(z.string(), BankConfigSchema)` с требованием хотя бы одного определения банка (непустой `sources` через `.refine(...)`); конкретный ключ `tochka` на уровне схемы не обязателен
- [x] 1.3 Аналогично обновить `ResolvedAppConfigSchema.sources` до record-формы; resolved `tochka` сохраняет `bankBic` и `typeCodes`
- [x] 1.4 Обновить экспортируемые типы (`AppConfig` и связанные), убедиться что `config.sources.tochka` остаётся доступен

## 2. loadConfig: объединённая карта счетов

- [x] 2.1 В `loadConfig` пройти по всем банкам `sources` и для каждого резолвить `accountMappings` против `hmAccounts` того же банка (ключ → id)
- [x] 2.2 Слить результаты в единую карту `Record<string, number>` (accountNumber → hmId)
- [x] 2.3 Добавить fail-fast при коллизии: один номер счёта мапится на разные hmId в разных банках — бросить ошибку с указанием номера (по образцу проверки депозитов на строках 119-123)
- [x] 2.4 Сохранить объединённую карту в resolved-конфиг так, чтобы её получали и `createAccountRegistry`, и существующая non-transfer ветка нормализации

## 3. createAccountRegistry над объединённой картой

- [x] 3.1 Перевести `createAccountRegistry` на объединённую карту вместо `config.sources.tochka.accountMappings`
- [x] 3.2 `isOwned`: проверять наличие счёта в объединённой карте (плюс существующая ветка `isDeposit`, без изменений)
- [x] 3.3 `getHmAccountId`: резолвить из объединённой карты (плюс существующая ветка `421*`-депозитов, без изменений)
- [x] 3.4 Убедиться, что `isDeposit` и депозитная эвристика по-прежнему завязаны только на `tochka.bankBic`

## 4. Согласование вызовов

- [x] 4.1 Прогнать `tsc`/`npm run check` и поправить все обращения к `config.sources.*`, переставшие типизироваться
- [x] 4.2 Проверить, что `src/apply/preview/tochka.ts` не требует изменений (опирается на реестр); при необходимости — минимальная правка

## 5. Конфиг и фикстуры

- [x] 5.1 Обновить `config/sources.example.json` под многобанковый формат с примерами `sber`/`tinkoff`
- [x] 5.2 Добавить фикстуру кросс-банковского SBP-перевода (Точка → Т-Банк) в `src/apply/preview/fixtures/`

## 6. Тесты

- [x] 6.1 Добавить тест: `SbpB2CPayment` Точка → Т-Банк даёт `normalized.type = transfer`, заполненный `counterpartyAccountId`, корректные `transfer_from_id`/`transfer_to_id`
- [x] 6.2 Добавить тест: исходящий SBP на счёт, отсутствующий во всех банках, остаётся `expense`
- [x] 6.3 Добавить тест загрузки конфига: коллизия номера счёта между банками → ошибка
- [x] 6.4 Добавить тест перевода между двумя банками (например, `tochka` и `tinkoff`): счета из обоих банков распознаются как owned, реестр резолвит оба `hmId`, и `getNormalizedType` даёт `transfer`
- [x] 6.5 Добавить тест схемы: пустой `sources` отвергается, конфиг хотя бы с одним банком проходит валидацию
- [x] 6.6 Прогнать весь `src/apply/preview-*.test.ts` — убедиться в отсутствии регрессий (`PaymentIncome`/`PaymentAccepted` с `OWNED_PAYER`/`OWNED_PAYEE`)

## 7. Документация

- [x] 7.1 Обновить `TRANSACTION-RULES.md`: «общий список моих счетов» охватывает все настроенные банки
- [x] 7.2 Финальный прогон `npm run check` — зелёный
