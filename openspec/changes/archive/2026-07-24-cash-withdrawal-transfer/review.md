## Verification Report: cash-withdrawal-transfer

Дата: 2026-07-24. Схема: `spec-driven`. Артефакты: proposal, design, specs (`tochka-transfer-preview`), tasks — все присутствуют, проверены все четыре измерения.

### Summary

| Dimension    | Status                                                                 |
|--------------|------------------------------------------------------------------------|
| Completeness | 24/24 задач отмечены; 3/3 требования дельта-спеки реализованы           |
| Correctness  | 3/3 требования покрыты кодом; 10/11 сценариев покрыты тестами или данными |
| Coherence    | Дизайн соблюдён; `npm run check` зелёный; 2 отклонения от STYLE-GUIDE   |
| Security     | Секретов в коде нет; `npm audit`: 1 high (pre-existing, dev-only)       |

**Проверено фактическими прогонами:**

- `npm run typecheck` — OK
- `npm run lint` (biome check, 94 файла) — OK
- `npm run check` (typecheck + lint + vitest) — 26 файлов, 188 тестов, все зелёные
- Реальные данные (задача 4.1): `npx tsx src/index.ts apply tochka --preview --skip-hmbee-cache-update` на `sync/tochka/2026-07-09_2026-07-23.json` — запись `tranId 4483988400` от 2026-07-21 классифицирована как `type = transfer`, `counterpartyAccountId = cash:rub`, `identified = true`, `save = true`, `reason = null`, `hmbee.subtype = t`, `transfer_from_id = 2053036` (Точка ИП. РУБЛИ) → `transfer_to_id = 5695` (Кошелек), `real_amount = transfer_to_amount = 9000`, `category = null`. Остальные записи окна: 68 expense/save, 3 income/save, 12 transfer/save, 5 transfer/excluded, 3 expense/no-save — ни одной новой записи с `identified = false`, регрессии классификации не видно.
- Задача 2.7: `git diff master...HEAD` затрагивает единственный тест-файл `src/apply/preview-CardTransactionInfo.test.ts`. Тесты `preview-PaymentAccepted`, `preview-PaymentIncome`, `preview-PaymentWrittenOff`, `preview-SbpB2CPayment`, `preview-SbpC2CPayment` не правились и зелёные — банковская ветка резолвинга ног не поехала.
- Конфиги: `config/sources.json` (локальный, в `.gitignore`) содержит источник `cash` с `id 5695` и ветку `included` `CashOutAtm + Withdraw`; `config/sources.example.json` содержит ту же ветку и источник `cash` с обезличенным `id 1000004`. Структурно синхронны.
- MCC `6011` отсутствует и в `categoryMapping.mcc`, и в `categoryMapping.ignored.mcc` — Решение 5 дизайна соблюдено.

### Issues

#### 🔴 CRITICAL (Must fix before archive)

- **`npm audit`: 1 high — postcss ≤8.5.17, path traversal при авто-загрузке source map (GHSA-r28c-9q8g-f849).**
  Цепочка: `vitest@4.1.5 → vite@8.0.16 → postcss@8.5.15`, то есть **dev-only транзитивная зависимость**. Уязвимость **не внесена этим изменением**: `package.json`/`package-lock.json` в диффе изменения не участвуют. Правило проверки безопасности не делает исключений для high/critical, поэтому пункт помечен CRITICAL, но по существу это дефект репозитория, а не данной работы.
  Рекомендация: выполнить `npm run check` после `npm audit fix` (фикс доступен без breaking change по данным `npm audit fix --dry-run`) и убедиться, что вся тестовая матрица зелёная. Решение принимать отдельно от архивации этого изменения.

#### 🟡 WARNING (Should fix)

- **`src/apply/preview-CardTransactionInfo.test.ts:117-133` — мок правил `CardTransactionInfo` не синхронизирован с реальным конфигом.**
  `cashOutOptions.typeCodeRules` **заменяет** правила базового `options` (`src/apply/preview-CardTransactionInfo.test.ts:45-89`), а не дополняет их: `included` содержит только ветку `CashOutAtm`, `excluded` — пустой `{ or: [] }`. При этом базовый `options` зеркалит `config/sources.json` (3 ветки `included` + `excluded` с `CheckCard`/`Purchase`), но ветку `CashOutAtm` в него не добавили, и теперь ни один мок в тестах не воспроизводит реальный набор правил целиком.
  STYLE-GUIDE прямо требует: «Всегда держать структурно синхронными `config/sources.json`, `config/sources.example.json` и тесты, которые мокают эту конфигурацию».
  Практическое следствие: тест «does not identify CashOutAtm in a status other than Withdraw» (`src/apply/preview-CardTransactionInfo.test.ts:237`) проверяет отсутствие матча против пустого `excluded`, то есть не подтверждает, что при **реальном** наборе правил `CashOutAtm + InProgress` не попадёт в `excluded`-ветку и не даст `included/excluded ambiguity`.
  Рекомендация: собрать `cashOutOptions.typeCodeRules` из базовых правил плюс ветка `CashOutAtm` — `included: { or: [...options.typeCodeRules.CardTransactionInfo.conditions.included.or, cashOutIncludedBranch] }`, `excluded` взять из базового `options` без изменений. Одновременно добавить ветку `CashOutAtm + Withdraw` в базовый `options`, чтобы мок совпадал с `config/sources.example.json`.

- **`src/apply/preview-CardTransactionInfo.test.ts:95` — реальный HM-`id` кошелька (`5695`) закоммичен в репозиторий.**
  Proposal (раздел «Нефункциональные требования») фиксирует: «реальный `id` HM-счёта попадает только в `config/sources.json` (не в репозиторий), в `sources.example.json` — обезличенное значение». Фактически `5695` присутствует в `src/apply/preview-CardTransactionInfo.test.ts:95`, а также в `design.md`, `proposal.md` и `tasks.md`. Остальные HM-`id` в этом тест-файле — фиктивные (`67890`), в example-конфиге — `1000004`.
  Это не секрет (внутренний идентификатор счёта Honey Money, прецедент уже есть в `src/hmbee/cache.test.ts:20`), поэтому риск низкий, но заявленное требование не выполнено.
  Рекомендация: заменить в тесте `cashWalletHmId` на фиктивное значение (например `1000004`, как в `config/sources.example.json`), а формулировку в proposal привести в соответствие с реальностью — документы изменения всё равно ссылаются на реальный `id` по смыслу.

#### 🟢 SUGGESTION (Nice to fix)

- **`src/apply/preview/tochka.ts:672,676` — сообщения об ошибке резолвинга ног не содержат, какой именно счёт не разрешился.**
  ```ts
  throw new Error(`Unable to resolve source (from) HM account ID for transfer`);
  throw new Error(`Unable to resolve destination (to) HM account ID for transfer`);
  ```
  STYLE-GUIDE: «Throw informative errors with actionable context». Соседний код в том же файле контекст даёт: `No Honey Money account mapping found for Tochka account ${normalized.account}`. Заодно оба литерала — шаблонные строки без интерполяции, backtick'и здесь лишние.
  Рекомендация: `Unable to resolve source (from) HM account ID for transfer: ${fromAccount}` и симметрично для `toAccount`. Тест `src/apply/preview-CardTransactionInfo.test.ts:262` сверяет точный текст `reason` — его придётся обновить (замена на `toContain` или полный текст с `cash:usd`), что как раз сделает сценарий «валюта без кошелька» из спеки более выразительным: `reason` будет буквально называть неразрешённую ногу.

- **`src/apply/preview/tochka.ts:463-468` — двойная проверка семейства записи в `getNormalizedType`.**
  ```ts
  if (isCardTransactionInfoRecord(sourceRecord)) {
    const { tranCode } = sourceRecord.data;
    if (isCashOutAtmRecord(sourceRecord)) { return 'transfer'; }
    return tranCode === 'ReverseByCard' ? 'income' : 'expense';
  }
  ```
  Внутри ветки, уже сузившейся до карточной записи, `isCashOutAtmRecord` повторно проверяет `type_code`; деструктуризация `tranCode` стоит выше своего единственного использования.
  Рекомендация: свести к `return tranCode === 'CashOutAtm' ? 'transfer' : tranCode === 'ReverseByCard' ? 'income' : 'expense'` **не следует** — это вернёт строку `'CashOutAtm'` в код вторым экземпляром, против Решения 3. Достаточно перенести деструктуризацию под проверку `isCashOutAtmRecord`, оставив сам guard как есть.

- **Сценарий спеки «Cash wallet for an additional currency requires no code change» не покрыт тестом.**
  Дельта-спека (`specs/tochka-transfer-preview/spec.md`, требование «Cash wallet accounts are resolved through account mappings configuration») утверждает, что кошелёк в другой валюте резолвится без правок кода. Тест `src/apply/preview-CardTransactionInfo.test.ts:262` проверяет только негативную половину (`USD` без кошелька → не сохраняется).
  Рекомендация: добавить кейс-близнец с `allAccountMappings: { ..., 'cash:usd': <dummyId> }` и записью в `USD` → `identified = true`, `counterpartyAccountId = 'cash:usd'`, `transfer_to_id = <dummyId>`. Это единственный тест, который реально доказывает конфигурационную расширяемость, заявленную в требовании.

- **Расхождение в подсчёте записей окна: задача 4.2 говорит про «остальные 89 записей», фактически в `sync/tochka/2026-07-09_2026-07-23.json` 91 запись** (90 не-снятий). Косметика, но при следующей сверке цифра собьёт с толку. Рекомендация: поправить формулировку в `tasks.md` (или считать её проверенной по факту — расхождений классификации прогон не выявил).

### Проверки, которые не выполнялись

- Сравнение классификации «до/после» по 90 остальным записям (задача 4.2) выполнено только в одну сторону: снят срез на текущем коде и подтверждено отсутствие неопознанных/неожиданных записей. Механически сравнить с прогоном на `master` невозможно — `config/sources.json` не версионируется, поэтому предыдущее состояние конфига невосстановимо. Косвенное подтверждение — 188 зелёных тестов и неизменённые тест-файлы пяти transfer-сценариев.
- Поведение `CashOutAtm` в статусе `InProgress` и запись комиссии за снятие сверх лимита не проверялись на реальных данных — таких записей в синке нет (это зафиксировано в Open Questions дизайна как осознанно отложенное).

### Final Assessment

1 critical issue found. Fix before archiving.

Оговорка по существу: единственный CRITICAL — pre-existing dev-only уязвимость `postcss` в транзитивной зависимости `vitest`, никак не связанная с этим изменением (`package.json`/`package-lock.json` в диффе отсутствуют). Сама реализация `cash-withdrawal-transfer` завершена: все 24 задачи выполнены, все три требования дельта-спеки реализованы и подтверждены на реальных данных, quality gates зелёные, дизайн соблюдён дословно (включая ключевое свойство «банковская ветка не переписана»). Если уязвимость решено закрывать отдельно от этого изменения, к архивации остаются 2 warning'а — рассинхрон мока правил с конфигом и реальный HM-`id` в тесте.
