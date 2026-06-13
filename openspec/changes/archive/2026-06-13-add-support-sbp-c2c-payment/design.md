## Context

Tochka SBP records are normalized in `src/apply/preview/tochka.ts` and classified by JSON-logic rules stored in `config/sources.json → sources.tochka.typeCodes.<type_code>`. The SBP family (`SbpB2CPayment`, `SbpC2BPayment`, `SbpC2BRefund`) shares a base data shape (`SbpBaseTransactionData`) and is handled generically by the accessors (`getSourceAccount`, `getCounterpartyAccount`, `getStatus`, `getAmount`, …), by `getNormalizedType` (incoming → income, outgoing → expense, both-owned → transfer), and by the rule engine.

`SbpC2CPayment` is currently rejected at `isSupportedTochkaTypeCode` and falls through to `unsupported type_code`. An observed record (`sync/tochka/2026-03-31_2026-06-02.json`) carries `incoming = true` and `status = "DONE"`. Its JSON additionally contains `payeeName` and a `phoneNumber`, but those describe me (the payee) or the sender's contact — fields that no accessor reads. `SbpBaseTransactionData` already covers every field the SBP accessors consume (including `payerName`, i.e. the meaningful counterparty for an incoming payment), so the base shape is a complete fit.

## Goals / Non-Goals

**Goals:**
- Treat an accepted incoming `SbpC2CPayment` (`status = DONE`, `incoming = true`) from an **external** payer as save-ready income.
- Treat an accepted incoming `SbpC2CPayment` whose **payer is one of my own accounts** (owned in any configured bank) as a save-ready transfer.
- Wire `SbpC2CPayment` into the existing SBP family with no new normalization branches; both scenarios fall out of the existing cross-bank registry + `getNormalizedType`.

**Non-Goals:**
- No new transfer-pairing/mirroring logic (the incoming leg is the only Tochka-side leg).
- No outgoing `SbpC2CPayment` (expense) handling — only the observed incoming slice.
- No changes to category mapping, apply, or sync layers.

## Decisions

- **Reuse the SBP family with the base data shape; do not copy B2C's payee-side fields.** Type the record's `data` as `SbpBaseTransactionData` directly (`SbpC2CPaymentRecord extends TochkaRecordMeta<'SbpC2CPayment'> { data: SbpBaseTransactionData }`), add it to the `SbpTransactionRecord` union, and extend `SbpTypeCode`, `SupportedTochkaTypeCode`, `isSupportedTochkaTypeCode`, and `isSbpTransactionRecord`. Every generic accessor, `getNormalizedType`, and transfer detection then cover it with zero extra branches.
  - *Why not mirror `SbpB2CPaymentData`'s `{ payeeName, phoneNumber }`:* for an **incoming** payment the payee is always me, so `payeeName` is a constant with no analytical value, and `phoneNumber` denotes the **sender's** contact (different meaning than B2C's recipient phone). Neither field is read by any accessor. Adding them would imply they matter and misrepresent direction. If sender identification is ever needed, `payerName` is already in the base; a sender-phone field can be added then, deliberately.
  - *Alternative considered:* a standalone C2C family with its own type guards — rejected as duplicative; the consumed shape and behavior match the SBP family exactly.
- **Classification by `status = DONE` + `incoming = true`.** Unlike `SbpC2B*` (`ACCEPTED`), the observed C2C status is `DONE`. `included = { status == "DONE" AND incoming == true }`; `excluded = { incoming == false }` to keep any outgoing form out of the save-ready income flow.
  - *Alternative considered:* mirroring `SbpC2BRefund` (`ACCEPTED` + `incoming`) — rejected because the observed status literal is `DONE`, not `ACCEPTED`.
- **Income vs transfer split stays in normalization — no new code.** `getNormalizedType` already returns `transfer` when both payer and payee are owned (via `registry.isOwned`, which spans every configured bank's `accountMappings`), else `income` for incoming SBP. The transfer branch then resolves both HM account IDs through `getHmAccountId` (also cross-bank). Worked example from `sync/tochka/2026-03-31_2026-06-12.json`:
  - *Income record:* payer `40817810338127700562` (Сбербанк) is **not** in any bank mapping → not owned → `type = income`.
  - *Transfer record:* payer `40817810900000136059` is mapped to `tinkoff-debetovaya` (HM id 5696) and payee `40802810309500023530` to `tochka-ip-rub` (HM id 2053036) → both owned → `type = transfer`; the HM transfer resolves `transfer_from_id = 5696` (Tinkoff) → `transfer_to_id = 2053036` (Tochka), matching the real money movement.
  This is the same mechanism already specified by `tochka-transfer-preview` ("Owned-account recognition spans all configured banks"); the only change is making `SbpC2CPayment` eligible for it.

## Engineering Constraints

- **Type safety:** keep TypeScript strict mode green; `SbpC2CPayment` must be added to every discriminated-union and type-guard site so the compiler enforces exhaustiveness (no `as`/`any` casts). `type_code` literal added to both the union type and the runtime guard.
- **Error handling:** preserve existing behavior — unknown/missing fields still funnel through the `try/catch` in `normalizeTochkaRecord` returning `identified = false` with a reason; no new throw paths.
- **Module boundaries:** changes confined to `src/apply/preview/tochka.ts` and config JSON; the rule engine, apply, and sync modules are untouched. Classification logic lives in config (`sources.json`), not in code.
- **Style/lint impact:** no new modules or patterns; existing Biome config applies unchanged. `npm run check` is the gate.

## Risks / Trade-offs

- **Status set assumed from a single observed record (`DONE`).** → Records with other (unknown) statuses match neither `included` nor `excluded` and safely fall through as `no matching included/excluded condition` (identified = false), surfacing them for follow-up rather than mis-saving.
- **Income-vs-transfer split depends entirely on registry coverage.** → An incoming C2C from one of my own accounts is a `transfer` only if that account is mapped in some bank's `accountMappings` (e.g. `tinkoff-debetovaya`). If a future own account is not yet registered, its C2C is classified as income (same trade-off already accepted for `SbpB2CPayment` in `TRANSACTION-RULES.md`); registering the account flips it to `transfer` with no code change. This is a config-completeness concern, not a logic gap.

## Migration Plan

Additive config + type change; no data migration. Rollback = revert the `tochka.ts` and `sources*.json` edits. Update `config/sources.json`, then `config/sources.example.json`, then tests, then `TRANSACTION-RULES.md`, per the documented ordering.

## Open Questions

- Are there non-`DONE` C2C statuses (e.g. canceled/rejected analogues)? Not observed in current sync data; deferred until such a record appears.
