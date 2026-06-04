## Context

Transfer classification in the Tochka preview pipeline already works correctly: `getNormalizedType()` returns `'transfer'` when both payer and payee accounts are owned. However, `buildHoneyMoneyTransaction()` has no transfer branch — it maps all records to `subtype: 'e' | 'i'` by checking `incoming`. As a result, transfers are sent to HoneyMoney as expenses, which corrupts budget category data.

HoneyMoney's transfer type (`subtype: 't'`) requires two additional fields: `transfer_from_id` (source HM account) and `transfer_to_id` (destination HM account). For regular accounts these IDs come from `accountMappings`. For Tochka deposit accounts (`421*`) no static mapping exists — a new resolution mechanism is needed.

## Goals / Non-Goals

**Goals:**
- Emit correct `subtype: 't'` HoneyMoney transactions for all records where `normalized.type === 'transfer'`
- Resolve destination HM account ID for deposit accounts without requiring per-deposit configuration entries
- Validate at config load that at most one deposit HM account exists per currency

**Non-Goals:**
- Cross-currency transfers (same-currency assumed; `transfer_to_amount === real_amount`)
- Transfers between accounts in different sources (e.g., Tochka → Tinkoff in the same sync batch)
- Retroactive correction of already-submitted HM transactions

## Decisions

### 1. Discriminated union for `HoneyMoneyTransaction`

`HoneyMoneyTransaction` becomes a union discriminated on `subtype`:

```typescript
type HoneyMoneyTransaction =
  | HoneyMoneyIncomeExpenseTransaction   // subtype: 'e' | 'i'
  | HoneyMoneyTransferTransaction        // subtype: 't'
```

**Why:** TypeScript enforces that transfer-specific fields (`transfer_from_id`, `transfer_to_id`) are only present on transfer records and required when subtype is `'t'`. A single interface with optional fields would allow incomplete transfer objects to compile.

**Alternative considered:** Single interface with optional fields and `subtype: 'e' | 'i' | 't'`. Rejected because TypeScript cannot enforce field presence based on the discriminant without narrowing.

### 2. Currency resolution via `account.slice(5, 8)` + `currenciesMapping`

Russian 20-digit account numbers embed the ISO-4217 numeric currency code at positions 6–8 (0-indexed: `slice(5, 8)`). A configurable `hmbee.currenciesMapping` (e.g. `{"810": "rub", "840": "usd", "978": "eur"}`) translates this to the HoneyMoney currency string.

**Why:** The ISO numeric code is structurally guaranteed by Russian banking regulation (CBR account plan), so it's reliable without additional API calls. Configuring the mapping keeps HM-specific currency codes decoupled from the extraction logic.

**Alternative considered:** Passing `normalized.currency` (the Tochka transaction currency string) through to `getHmAccountId`. Rejected because Tochka's currency strings (e.g. `"RUB"`) are not in HoneyMoney format (`"rub"`), and `.toLowerCase()` is only a coincidence — the proper mapping belongs in config, not in string manipulation.

### 3. `isDeposit` flag on `hmAccounts` entries

Deposit HM accounts are explicitly marked in config with `isDeposit: true`. `createAccountRegistry` builds a `depositByCurrency` map at init time. Config load fails if any currency has more than one deposit account.

**Why:** Explicit marking avoids coupling the HM account selection logic to naming conventions. The one-per-currency invariant is a business rule that should be enforced at startup, not silently resolved at runtime.

### 4. `getHmAccountId` absorbs the deposit resolution

```
getHmAccountId(account):
  1. direct mapping → return
  2. isDeposit(account) → slice(5,8) → currenciesMapping → depositByCurrency → return
  3. undefined
```

**Why:** Callers (`normalizeTochkaRecord`) should not need to know whether the counterparty is a deposit or a regular account. Keeping the lookup behind a single method preserves the existing interface shape (no new parameters).

### 5. `buildHoneyMoneyTransaction` receives `counterpartyHmId`

`normalizeTochkaRecord` resolves `counterpartyHmId = registry.getHmAccountId(normalized.counterpartyAccountId)` before calling `buildHoneyMoneyTransaction`. If the result is `undefined` for a transfer, an error is thrown (caught by the existing try/catch → `identified: false`).

**Why:** Resolution failure should surface as an unidentified record rather than a runtime crash during apply. The existing error-handling pattern in `normalizeTochkaRecord` already handles this.

## Risks / Trade-offs

- **Deposit account BIC validation gap** → The deposit heuristic (`421*` + Tochka BIC) is applied during transfer classification, but `getHmAccountId` only uses the account number prefix. A deposit account at a different bank starting with `421` would incorrectly match. Mitigation: this case is structurally impossible within a single Tochka source — all payee accounts in the transfer path carry the Tochka BIC.
- **Same-currency assumption** → `transfer_to_amount = real_amount` is correct only when both accounts share a currency. Multi-currency transfers would silently produce a wrong amount. Mitigation: documented as a known limitation; a future change can extend the model.
- **Config backward compatibility** → `hmbee` and `isDeposit` are new optional keys. Existing `sources.json` files without them remain valid. Validation only triggers if `isDeposit: true` appears more than once per currency.

## Engineering Constraints

- All new types must pass TypeScript strict mode; no `as` casts on the discriminated union.
- `getHmAccountId` must not throw — it returns `undefined` on resolution failure; the caller handles the error.
- `currenciesMapping` lookup failures (unknown ISO code) return `undefined` gracefully.
- New code follows the existing file structure: type declarations in `types.ts`, config logic in `config.ts`, normalization in `tochka.ts`.
- `npm run check` (typecheck + lint + tests) must pass before the change is considered done.

## Migration Plan

No migration needed. The change only affects new HM transactions written by the apply command. Previously written (incorrect) expense records are not corrected automatically — this is accepted per Non-Goals.

## Open Questions

None — all design decisions were resolved during exploration.
