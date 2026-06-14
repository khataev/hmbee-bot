# Technical Debt

## Summary
Tracking identified technical debt and planned simplifications.

## Items

### 1. Simplify sync output format
- **Context**: Currently `sync` command supports `--format <type>` (adapted|raw).
- **Goal**: Deprecate and remove `raw` format, making `adapted` the only supported and default behavior.
- **Why**: Reduces complexity in pipeline interpretation and simplifies consumer logic.
- **Status**: Added 2026-05-10.

### 2. Use only absolute paths in imports
 - **Context**: Biome checks currently allow relative imports.
- **Goal**: Use only absolute paths in imports for consistency.
- **Status**: Added 2026-05-10.

### 3. Типизация схем загрузки конфига
- **Context**: `AppConfigSchema.sources` использует `z.record(z.string(), BankConfigSchema)`, из-за чего Zod не применяет банк-специфичные схемы (например, `TochkaBankConfigSchema` с обязательным `bankBic`) к конкретным ключам вроде `tochka`. В итоге `TochkaBankConfigSchema` / `TochkaBankConfig` объявлены, но не применяются при парсинге.
- **Goal**:
    - Добавить `.superRefine` на `sources`, чтобы ключ `tochka` валидировался через `TochkaBankConfigSchema`.
    - По аналогии создать `ResolvedTochkaBankConfigSchema` для симметрии с input-схемами.
- **Why**: Без этого отсутствие `bankBic` в секции `tochka` не отловится при загрузке конфига, а `isDeposit` молча перестанет работать.
- **Status**: Added 2026-06-12. (OpenSpec: multi-bank-owned-accounts, review.md)

### 4. Более точный маппинг title `ООО "Банк Точка"`
- **Context**: Сейчас title `ООО "Банк Точка"` смаплен одной записью, но под ним проходят разнородные операции: комиссии за банковское обслуживание (`activityId=tariffer-…`, `cbs-tb-…`) и проценты по депозитам. Одна категория не различает эти сценарии.
- **Goal**: Разделить классификацию по дополнительным признакам сырой записи (например, `activityId`/`type_code`), чтобы комиссии и проценты по депозитам попадали в разные категории.
- **Why**: Точность аналитики расходов/доходов: банковское обслуживание и проценты по депозитам — это разные статьи.
- **Status**: Added 2026-06-13.

### 5. Более точный маппинг title `АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОЧКА"`
- **Context**: Под этим title проходят как минимум два разных сценария: комиссия за СМС-информирование (`activityId=sms-commission-…`) и cashback. Сейчас они смаплены в одну категорию.
- **Goal**: Различать комиссию за СМС и cashback (разные категории; cashback к тому же доход, а комиссия — расход).
- **Why**: Без различения доход (cashback) и расход (комиссия) смешиваются под одним title.
- **Status**: Added 2026-06-13.

### 6. Рефакторинг инфраструктуры CLI

- **Context**: Весь код команд `sync` и `apply` (валидация, оркестрация, вызовы клиентов) сосредоточен в `src/index.ts`. Параллельно `src/apply/` содержит и логику preview/нормализации, и вспомогательные функции самой команды, без чёткой границы между ними.
- **Goal**:
  - Вынести полную логику каждой команды в отдельный модуль (`src/commands/sync.ts`, `src/commands/apply.ts`); `src/index.ts` только регистрирует команды и вызывает их.
  - Пересмотреть иерархию `src/apply/`: отделить pipeline нормализации/preview (сейчас `src/apply/preview/`) от точки входа команды, сделать зависимости однонаправленными.
- **Why**: Файл `src/index.ts` не тестируется и растёт с каждой командой. Размытая граница между командой `apply` и её sub-pipeline усложняет навигацию и добавление новых шагов (например, skip-индекса).
- **Status**: Added 2026-06-13.

### 7. Разделить `ignored` и тип маппинга классификатора
- **Context**: `ignored` (mcc/title) — настройка только для интерактивного скрипта `scripts/tochka-mapping.js` (чтобы не переспрашивать про уже отмеченные записи). Runtime-классификатор её не использует и не должен. Однако сейчас `ignored` живёт в общей схеме `categoryMapping` (`ResolvedCategoryMappingSchema`), а тип классификатора получается из неё через `CategoryMapping = Omit<…, 'ignored'>` (`src/config.ts`), то есть определения пересекаются.
- **Goal**: Вынести `ignored` в отдельную конфиг-секцию/схему, не пересекающуюся с типом `CategoryMapping`, который использует классификатор. Убрать связку через `Omit`.
- **Why**: Скриптовая настройка не должна структурно входить в тип, потребляемый классификатором; это снизит риск случайного использования `ignored` в runtime и сделает границы ответственности явными.
- **Status**: Added 2026-06-13.