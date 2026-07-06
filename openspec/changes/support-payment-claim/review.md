## Verification Report: support-payment-claim

### Summary
| Dimension    | Status                          |
|--------------|---------------------------------|
| Completeness | 13/13 tasks, 2 capabilities     |
| Correctness  | 6/6 requirements covered        |
| Coherence    | Followed — no style violations  |
| Security     | Clean — 0 secrets, 0 vulns      |

### Issues

#### 🔴 CRITICAL (Must fix before archive)
_None._

#### 🟡 WARNING (Should fix)
_None._

#### 🟢 SUGGESTION (Nice to fix)
- **Fixtures use realistic account numbers.** `src/apply/preview/fixtures/payment-claim-sms.json` / `payment-claim-license.json` carry `payerAccountId`/`payeeAccountId` copied from real sync data. This matches the existing fixture convention in the repo (other `payment-*` fixtures do the same) and the STYLE-GUIDE dummy-data rule targets `config/sources.example.json` (which is correctly sanitized), so this is not a violation. If these are your own live account numbers, consider masking digits in fixtures for consistency with the example config discipline.

### Verified Details

**Completeness (13/13)**
- All tasks in `tasks.md` checked; `openspec status` reports `all_done`.
- New capability `tochka-payment-claim-preview` (5 requirements) and modified `tochka-category-mapping` (1 requirement) both implemented.

**Correctness (spec → code mapping)**
- _PaymentClaim recognized as supported type_: `isSupportedTochkaTypeCode` + union `TochkaSyncRecord` + `isPaymentClaimRecord` — `src/apply/preview/tochka.ts:230`, `:210`, `:275`.
- _Field normalization_ (`claimId`/`objectState`/`sum`/`currency`/`payerAccountId`, `description = purpose`): dispatchers at `tochka.ts:307`, `:399`, `:414`, `:369`, `:339`, `:423`. `getDescription` correctly branches `PaymentClaim → purpose` **before** the RS `title` branch.
- _Always expense; direction ignored; no transfer detection_: `getNormalizedType` returns `'expense'` at `tochka.ts:449` before transfer detection; `PaymentClaim` deliberately excluded from `isBankPaymentRecord` (`:279`) and `getCounterpartyAccount` returns `undefined` (`:346`). Test asserts `counterpartyAccountId` undefined.
- _included = objectState Processed, excluded empty_: `config/sources.json` + `config/sources.example.json` both carry `{"==":[{"var":"record.data.objectState"},"Processed"]}` / `{"or":[]}`. Non-`Processed` → `no matching included/excluded condition` (test at `preview-PaymentClaim.test.ts:101`).
- _Category rules migrated_: both rules (СМС-информирование, лицензионное вознаграждение) now guard on `PaymentClaim`, no `PaymentWrittenOff` duplicates remain for these two; synced across both config files.
- _Focused tests_: `src/apply/preview-PaymentClaim.test.ts` covers both happy-path fixtures + non-Processed case; `preview-category-rules.test.ts` migrated to `PaymentClaim`.

**Coherence**
- Design decisions (claimId as id, purpose as description, always-expense, not-bank-payment, Processed-only, rule migration, config sync) all faithfully implemented.
- Config sync discipline honored: `sources.json` ↔ `sources.example.json` ↔ mocked test config all structurally aligned; example uses sanitized descriptions.
- Absolute `src/` imports throughout; no relative imports; source-specific logic stays in `preview/tochka.ts`. Tests use `as` assertions, not `throw`, for narrowing.
- Empty `excluded` (`{"or":[]}`) is consistent with the STYLE-GUIDE preview-authoring rule: unknown statuses remain unmatched and surface for deliberate review.
- `npm run check` (typecheck + Biome lint + 163 tests) — **all green**.
- `TRANSACTION-RULES.md` updated with a `PaymentClaim` row and migration notes.

**Security**
- No hardcoded tokens/passwords/API keys/cookies in changed files.
- `npm audit` — **found 0 vulnerabilities**.

### Final Assessment
All checks passed. Ready for archive.
