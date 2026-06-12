# Technical Debt

## Summary
Tracking identified technical debt and planned simplifications.

## Items

### 1. Simplify sync output format
- **Context**: Currently `sync` command supports `--format <type>` (adapted|raw).
- **Goal**: Deprecate and remove `raw` format, making `adapted` the only supported and default behavior.
- **Why**: Reduces complexity in pipeline interpretation and simplifies consumer logic.
- **Status**: Added 2026-05-10.

### 2. Standardize `sync` output and remove `--out` flag
- **Context**: The `sync` command currently allows a custom output path via `--out`.
- **Goal**: 
    - Remove the `--out` flag.
    - Standardize output path to `sync/[source]/[from]_[to].json` by default.
- **Why**: Ensures predictable file discovery for the `apply` command and reduces operator decision overhead.
- **Status**: Completed 2026-05-11. (OpenSpec: sync-fiename-improvement)

### 3. Use only absolute paths in imports
 - **Context**: Biome checks currently allow relative imports.
- **Goal**: Use only absolute paths in imports for consistency.
- **Status**: Added 2026-05-10.

### 4. Типизация схем загрузки конфига
- **Context**: `AppConfigSchema.sources` использует `z.record(z.string(), BankConfigSchema)`, из-за чего Zod не применяет банк-специфичные схемы (например, `TochkaBankConfigSchema` с обязательным `bankBic`) к конкретным ключам вроде `tochka`. В итоге `TochkaBankConfigSchema` / `TochkaBankConfig` объявлены, но не применяются при парсинге.
- **Goal**:
    - Добавить `.superRefine` на `sources`, чтобы ключ `tochka` валидировался через `TochkaBankConfigSchema`.
    - По аналогии создать `ResolvedTochkaBankConfigSchema` для симметрии с input-схемами.
- **Why**: Без этого отсутствие `bankBic` в секции `tochka` не отловится при загрузке конфига, а `isDeposit` молча перестанет работать.
- **Status**: Added 2026-06-12. (OpenSpec: multi-bank-owned-accounts, review.md)