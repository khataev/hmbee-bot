## Why

Synced Tochka timelines contain incoming `SbpC2CPayment` records covering two real scenarios observed in `sync/tochka/2026-03-31_2026-06-12.json`:
1. **Income** — a payment from a third-party individual (e.g. payer "Мария Алексеевна А.", Сбербанк) to my Tochka account.
2. **Own-account transfer** — a payment from my own account in another bank (payer "Андрей Рафаилович Х.", account `40817810900000136059` mapped to `tinkoff-debetovaya`) to my Tochka account.

Today `SbpC2CPayment` is not in the supported set, so both are dropped with `unsupported type_code: SbpC2CPayment` — real income and a real internal transfer are silently lost from the preview/apply flow.

## What Changes

- Recognize `SbpC2CPayment` as a supported Tochka SBP `type_code`.
- Classify an accepted incoming `SbpC2CPayment` (`status = DONE`, `incoming = true`) from an external payer as a save-ready **income** record.
- Classify an accepted incoming `SbpC2CPayment` whose payer is one of my own accounts (owned in any configured bank) as a save-ready **transfer** record — reusing the existing cross-bank owned-account registry and `getNormalizedType`; no new transfer logic is introduced.
- Exclude non-income forms (`incoming = false`) from the save-ready flow.
- Add JSON-logic `included`/`excluded` conditions for `SbpC2CPayment` to `config/sources.json` and `config/sources.example.json`.
- Add a dedicated `preview-SbpC2CPayment.test.ts` with fixtures, and document the new rows in `TRANSACTION-RULES.md`.

Non-functional: change stays within the existing rule-engine + normalization architecture (no new modules); `npm run check` (Biome lint/format + TypeScript strict) must pass and is the quality gate for this change.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `source-preview`: extend the "first SBP income and expense slice" requirement to classify an accepted incoming `SbpC2CPayment` from an external payer as a save-ready income record.
- `tochka-transfer-preview`: extend the "owned-account recognition spans all configured banks" behavior to also cover incoming `SbpC2CPayment` whose payer is my own account in another bank, classifying it as a save-ready transfer.

## Impact

- Config: `config/sources.json`, `config/sources.example.json` (new `typeCodes.SbpC2CPayment` entry).
- Code: `src/apply/preview/tochka.ts` (new `SbpC2CPaymentData`/`SbpC2CPaymentRecord` types, add to `SbpTransactionRecord` union, `SbpTypeCode`, `SupportedTochkaTypeCode`, `isSupportedTochkaTypeCode`, `isSbpTransactionRecord`). Normalization, amount/account/status accessors, and transfer detection already cover the SBP family generically.
- Tests: new `src/apply/preview-SbpC2CPayment.test.ts` and fixtures under `src/apply/preview/fixtures/`.
- Docs: `TRANSACTION-RULES.md`.
- No breaking changes; previously unsupported records become identified.
