## 1. Границы Tochka-синка учитывают часовой пояс

- [x] 1.1 Добавить чистую функцию, обратную `toDateInTimezone` (`src/apply/preview/tochka.ts`): по календарной дате (`YYYY-MM-DD`) и `time_zone` вычисляет ISO-моменты начала (`00:00:00.000`) и конца (`23:59:59.999`) суток этой даты в указанном поясе, тем же приёмом через `Intl.DateTimeFormat`.
- [x] 1.2 В `src/adapters/tochka.ts` (`TochkaAdapter.sync`/`fetchPage`) заменить построение `start_date`/`end_date` (`${options.from}T00:00:00.000Z` / `${options.to}T23:59:59.999Z`) на вызов новой функции с `config.time_zone`, прокинув `time_zone` через `SyncOptions` (или иной путь, согласованный с существующей передачей опций в адаптер).
- [ ] 1.3 Юнит-тесты новой функции границ: событие в первые часы локальных суток (`00:00`–`05:00` при `+05:00`) остаётся в пределах запрошенного дня; дневное событие — поведение не меняется (аналогично сценариям `preview-tochka-timezone.test.ts`, но для построения границ, а не нормализации).
- [ ] 1.4 Тест на `TochkaAdapter.sync`/`fetchPage` (мок `fetch`) — реальный `start_date`/`end_date` в теле запроса действительно построен через новую функцию для `time_zone = "Europe/Moscow"`.
- [ ] 1.5 `npm run check` проходит.

## 2. `PaymentIncome` от своего счёта в другом банке не теряется

- [ ] 2.1 В `config/sources.json` (`sources.tochka.typeCodes.PaymentIncome.conditions.excluded`) добавить условие `payerBankBic == "044525104"` к существующей ветке дедупа (сузить исключение до перевода именно внутри Точки).
- [ ] 2.2 В `config/sources.json` (`sources.tochka.typeCodes.PaymentIncome.conditions.included`) добавить новую ветку: `incoming == true AND isComission == false AND is_owned(payeeAccountId) AND is_owned(payerAccountId) AND payerBankBic != "044525104"`.
- [ ] 2.3 Тест `normalizeTochkaRecord` (`src/apply/preview/tochka.ts` / соответствующий test-файл): фикстура `PaymentIncome` с `payerAccountId`/`payerBankBic` стороннего банка (например, Райффайзен), обоими счетами "своими" — ожидается `identified=true`, `save=true`, `normalized.type=transfer`, `counterpartyAccountId` равен счёту-плательщику, `hmbee.transfer_from_id`/`transfer_to_id` разрешены корректно.
- [ ] 2.4 Тест `normalizeTochkaRecord` на регресс существующего сценария: внутренний перевод Точка → Точка (`PaymentIncome`, оба счёта — Точка) по-прежнему даёт `identified=true`, `save=false`, `reason="excluded"`.
- [ ] 2.5 Тест на сценарий "депозит" (`PaymentIncome` от Tochka deposit-like счёта) не задет изменением — остаётся `save=true` как раньше (регресс существующего теста/сценария спеки).
- [ ] 2.6 `npm run check` проходит.

## 3. Финальная проверка

- [ ] 3.1 Прогнать `npx tsx src/index.ts apply tochka --preview` (или актуальный эквивалент) на исходном инцидентном sync-файле/расширенном периоде и убедиться, что транзакция Райффайзен → Точка. Фонд EAZY (2026-08-17, 23000₽) теперь `identified=true, save=true, type=transfer`.
- [ ] 3.2 Полный `npm run check` по всему проекту.
