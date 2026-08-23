## Context

См. proposal.md — Why. Технический контекст, важный для реализации:

- Классификация Точка-записей идёт в два независимых шага (`src/apply/preview/tochka.ts`):
  1. `classifyByRule` — JSON-logic `included`/`excluded` из `config/sources.json`, решает только `identified`/`save`/`reason`.
  2. `getNormalizedType` — TypeScript-код, решает `income`/`expense`/`transfer`. Для любой `BankPaymentRecord` (включая весь `SbpTransactionRecord`, то есть и `SbpB2CPayment`, и `SbpC2CPayment`) уже реализована generic-проверка: если и `payerAccountId`, и `payeeAccountId` owned — `transfer`, иначе для SBP — `incoming ? income : expense`.
- Для `SbpC2CPayment` этот принцип уже применён: `included` в `sources.json` пропускает весь `incoming = true` (`status = DONE`) без проверки owned в JSON-logic, дифференциация income/transfer происходит только в `getNormalizedType`.
- Для `SbpB2CPayment` incoming-форма сейчас безусловно в `excluded`, поэтому шаг 2 до неё не доходит осмысленно (`save` всё равно `false`).
- `is_owned` (`src/apply/preview/ruleEngine.ts`) резолвит владение счётом через `AccountRegistry`, собранный из `accountMappings` всех источников в `config/sources.json` — счёт Райффайзена там пока не зарегистрирован.

## Goals / Non-Goals

**Goals:**
- Привести `included`/`excluded` для `SbpB2CPayment` к тому же виду, что и у `SbpC2CPayment`, без дублирования owned-проверки в JSON-logic.
- Зарегистрировать счёт Райффайзена, чтобы реальная транзакция резолвилась как `transfer`.
- Сохранить обратную совместимость поведения для исходящей ветки `SbpB2CPayment` (не трогать существующий `included`-кейс `incoming=false AND OWNED_PAYER`).

**Non-Goals:**
- Не решать судьбу гипотетического "входящего B2C от постороннего юрлица" — этот сценарий явно остаётся `identified=false` (не подпадает ни под `included`, ни под `excluded`), а не помечается как income или как excluded. Специальных тестов/документации под него в этом change не заводим.
- Не менять `getNormalizedType`, `is_owned`, `AccountRegistry` — вся нужная логика там уже существует и переиспользуется как есть.
- Не трогать `scripts/tochka-mapping.js` (map:tochka) — отдельная задача, уходит в TECH-DEBT.md.

## Decisions

**1. Добавить отдельную incoming-ветку `incoming=true AND OWNED_PAYER` в `included`, с owned-проверкой в JSON-logic — а не безусловно пропускать весь `incoming=true`.**
Рассмотренная альтернатива — скопировать паттерн `SbpC2CPayment`, где `included` пропускает весь `incoming=true` без owned-проверки, а различение income/transfer полностью отдаётся `getNormalizedType`. Отвергнута: это работает для `SbpC2CPayment`, но для `SbpB2CPayment` неявно решает судьбу недоказанного сценария "входящий платёж от постороннего" — такая запись автоматически получила бы `save=true, type=income`, то есть мы бы угадали бизнес-поведение, которое никто не подтверждал. Кроме того, у `SbpB2CPayment` owned-проверка в JSON-logic — это не новый паттерн: исходящая ветка того же type_code уже содержит `is_owned(payerAccountId, ...)` в `included` (`incoming=false AND OWNED_PAYER`), так что явная ветка `incoming=true AND OWNED_PAYER` продолжает уже существующий для этого type_code стиль, а не копирует чужой.
Выбранный вариант: `included = (incoming=false AND OWNED_PAYER) OR (incoming=true AND OWNED_PAYER)`, `excluded = status in {CANCELED, REJECTED}`. Побочный эффект: входящий платёж от НЕ owned плательщика (подкейс "посторонний") не матчит ни `included`, ни `excluded` → `identified=false, reason="no matching included/excluded condition"` — запись остаётся видна в превью как неопознанная, вместо того чтобы быть тихо классифицированной как income. Это осознанно: решение по этому сценарию откладывается до появления реального примера.

**2. Регистрация Райффайзена как обычного источника `accountMappings`, без синка.**
Счёт регистрируется только для `is_owned`-резолюции (по аналогии с `tinkoff` в `sources.example.json`) — никакого реального Tochka-адаптера для Райффайзена не создаётся, `hmAccounts`/`accountMappings` используются исключительно как справочник "чьи это счета" для `AccountRegistry`.

**3. `excluded` сужается до `status in {CANCELED, REJECTED}`.**
Было: `status in {CANCELED, REJECTED} OR incoming=true`. Убираем `incoming=true` целиком — новый `included` покрывает только owned-случай, а не-owned incoming сознательно не матчит ни `included`, ни `excluded` (см. решение 1), сохраняем проверку статуса — отменённые/отклонённые входящие платежи по-прежнему не должны попадать в Honey Money.

## Risks / Trade-offs

- **[Risk]** Будущий реальный "входящий B2C от постороннего" будет падать в `identified=false, reason="no matching included/excluded condition"` — то есть просто не появится в Honey Money до ручного решения, а не тихо потеряется как `excluded`-запись (для оператора разница видна только в тексте `reason` в превью). → Mitigation: это осознанный выбор (см. решение 1); когда такая запись реально появится, для неё заводится собственное правило `included`/`excluded` в отдельном change.
- **[Risk]** Изменение `included`/`excluded` меняет поведение задним числом только для будущих sync-файлов; исторические уже дропнутые входящие `SbpB2CPayment` (если такие были до Райффайзена) не переклассифицируются автоматически. → Mitigation: пересчёт исторических периодов не в скоупе (см. прецедент в TRANSACTION-RULES.md для `PaymentClaim`), можно прогнать `map:tochka`/apply повторно вручную при необходимости.

## Engineering Constraints

- Изменения в `config/sources.json`/`sources.example.json` — только данные (JSON), без новых модулей; `npm run check` (typecheck + Biome lint) должен проходить без изменений в самом коде `tochka.ts`/`ruleEngine.ts`.
- Новые/изменённые тесты в `src/apply/preview-SbpB2CPayment.test.ts` следуют существующему стилю файла (fixture-driven, `vitest`, строгая типизация `TochkaSyncRecord`/`ReadyApplyRecord`) — никаких новых зависимостей.
- Новая фикстура транзакции размещается в `src/apply/preview/fixtures/` с маскированными персональными данными (по аналогии с уже существующими фикстурами вроде `sbp-b2c-payment-own-transfer.json`), реальные номера счетов/суммы из синка не переносятся один в один без необходимости — используются тестовые account id, зарегистрированные в `options.accountMappings` теста.
- `TRANSACTION-RULES.md` обновляется первым (до `sources.json`) согласно правилу "Как поддерживать документ дальше" в этом же файле.

## Migration Plan

Прямое изменение конфигурации и правил без флагов — деплоя/раскатки как таковой нет (personal CLI-инструмент). Порядок применения: `TRANSACTION-RULES.md` → `config/sources.json` → `config/sources.example.json` → тесты. Откат — `git revert` при необходимости, состояние Honey Money не мутируется этим change (только preview/save-логика на будущих синках).
