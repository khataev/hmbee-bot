## Why

Tochka source records classified as transfers (both payer and payee are owned accounts) are currently converted to HoneyMoney as regular expenses (`subtype: 'e'`). HoneyMoney has a dedicated transfer type (`subtype: 't'`) with a different data structure that links source and destination accounts — without it, transfers are misrepresented as expenses and pollute budget categories.

## What Changes

- **HoneyMoney transaction type** gains a `transfer` variant (`subtype: 't'`) with required fields `transfer_from_id`, `transfer_to_id`, `transfer_to_amount`.
- **Config schema** gains a top-level `hmbee.currenciesMapping` key (ISO numeric → HM currency code, e.g. `"810": "rub"`) used to resolve deposit account currencies from account numbers.
- **`hmAccounts` entries** gain an optional `isDeposit: boolean` flag; at most one deposit account per currency is allowed (config load error if violated).
- **`AccountRegistry.getHmAccountId`** gains deposit fallback: if an account is deposit-like (`421*`), extract ISO currency code from `account.slice(5, 8)`, map via `currenciesMapping`, and return the matching deposit HM account ID.
- **`buildHoneyMoneyTransaction`** gains a transfer branch: when `normalized.type === 'transfer'`, emit `subtype: 't'`, positive `real_amount`, and both account IDs instead of expense fields.
- **Existing transfer tests** are updated to expect `subtype: 't'` (currently asserting the incorrect `'e'`).
- **`sources.example.json`** is updated to include `tochka-ip-deposits` with `isDeposit: true` and a `hmbee.currenciesMapping` section; `sources.json` is kept structurally in sync.

## Capabilities

### New Capabilities
- `hm-transfer-conversion`: Converts Tochka transfer records into valid HoneyMoney transfer transactions with correct `subtype: 't'`, linked account IDs, and amount.
- `deposit-account-hm-resolution`: Resolves the HoneyMoney account ID for Tochka deposit-like accounts (`421*`) via ISO currency code extracted from the account number and a configurable currencies mapping.

### Modified Capabilities
- `tochka-transfer-preview`: No requirement changes — transfer classification and `counterpartyAccountId` emission already specified. No delta spec needed.

## Impact

- `src/apply/preview/types.ts` — `HoneyMoneyTransaction` becomes a discriminated union
- `src/hmbee/client.ts` — no logic change; sends whatever shape `HoneyMoneyTransaction` is
- `src/config.ts` — new `hmbee` top-level config section, `isDeposit` on `hmAccounts`, `getHmAccountId` deposit fallback, config validation for duplicate deposit currencies
- `src/apply/preview/tochka.ts` — `buildHoneyMoneyTransaction` transfer branch, `normalizeTochkaRecord` passes counterparty account for ID resolution
- `config/sources.example.json` — structural update with `hmbee` section and `isDeposit` flag
- `config/sources.json` — structural sync (no sensitive data changes)
- Tests: `preview-PaymentAccepted.test.ts`, `preview-PaymentWrittenOff.test.ts` — update transfer assertions; add deposit transfer fixture and test
- Quality gate: `npm run check` (typecheck + lint + tests) must pass
