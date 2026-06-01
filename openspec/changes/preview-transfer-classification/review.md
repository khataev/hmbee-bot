# Code Review: preview-transfer-classification

**Branch**: HMB-16-preview-transfers  
**Change**: preview-transfer-classification  
**Quality gate**: `npm run check` — ✅ 9/9 test files, 38/38 tests pass, typecheck and lint clean  
**npm audit**: ✅ 0 vulnerabilities

---

## 🟡 WARNING — Silent error swallowing in `ruleEngine.ts:44-47`

```ts
} catch (_error) {
  return false;
}
```

`evaluateRule` silently suppresses all `jsonLogic.apply` errors. Per styleguide: "Do not swallow errors silently." When combined with `z.any()` in `JsonLogicRuleSchema` (which allows any JSON structure through Zod), the failure chain is invisible:

1. Config loads successfully — Zod doesn't validate rule structure.
2. Malformed rule throws inside `jsonLogic.apply`.
3. `evaluateRule` catches the error and returns `false`.
4. `classifyByRule` returns `reason: 'no matching included/excluded condition'` — indistinguishable from a legitimately unclassified record.

**Impact**: A misconfigured rule in `sources.json` silently drops transactions with no actionable diagnostic.

**Fix**: Change `evaluateRule` signature to return `{ matched: boolean; error?: string }` (or throw), and propagate the error message into `reason` in `classifyByRule`, e.g. `reason: 'rule evaluation error: <message>'`. This makes rule authoring bugs immediately visible in preview output.

---

## 🟡 WARNING — `PaymentWrittenOffData` missing BIC fields, masked by unsafe type cast (`tochka.ts:363-365`)

`PaymentWrittenOffData` does not declare `payerBankBic` or `payeeBankBic`. But `getNormalizedType` accesses them via an unsafe cast:

```ts
registry.isOwned(sourceRecord.data.payerAccountId, (sourceRecord.data as SbpBaseTransactionData).payerBankBic) &&
registry.isOwned(sourceRecord.data.payeeAccountId, (sourceRecord.data as SbpBaseTransactionData).payeeBankBic);
```

At runtime, both `payerBankBic` and `payeeBankBic` are `undefined` for `PaymentWrittenOff` records. The BIC-based deposit heuristic (`account.startsWith('421') && bic === '044525104'`) silently cannot fire, so deposit accounts must be explicitly listed in `accountMappings` for `PaymentWrittenOff` transfer detection to work.

The same pattern appears in the PaymentWrittenOff JSON Logic rule (test `preview-PaymentWrittenOff.test.ts:47-58`) which references `record.data.payerBankBic` — this evaluates to `null` at runtime, so `is_owned` effectively degrades to account-map-only matching for this record type.

**Fix**: Rewrite `getNormalizedType` (and related helpers) to use proper type narrowing per branch — no cross-record casts. When `isPaymentWrittenOffRecord(sourceRecord)` is true, `sourceRecord.data` must be accessed as `PaymentWrittenOffData` only, using the fields actually declared on that interface. Each record family should be handled with its own fully-typed branch. If `PaymentWrittenOff` records do carry BIC fields in practice, add them to `PaymentWrittenOffData` explicitly.

---

## 🟡 WARNING — BIC `'044525104'` must move to tochka config

The string `'044525104'` (Tochka bank BIC) appears independently in two places:

- `config.ts:89`: `const TOCHKA_BIC = '044525104'` — scoped locally to `createAccountRegistry`
- `ruleEngine.ts:27`: `return bic === '044525104' && account.startsWith('421')` — hardcoded in `is_deposit`

This is a source-specific constant that belongs in configuration, not code. The `is_deposit` heuristic depends on a bank BIC that can change or differ between environments.

**Fix**: Add a `bankBic` field to the tochka section of `sources.json` and its corresponding Zod schema / TypeScript type. Pass the resolved BIC into `createAccountRegistry` and into the rule evaluation context so both `isOwned` and `is_deposit` read it from config rather than hardcoding it.

---

## 🟢 TECH DEBT — `description` field template not yet implemented (`tochka.ts:588`)

```ts
description: String(Math.abs(normalizedAmount)),
```

Current behavior is intentional: when no description template is applied, `description` falls back to the absolute amount as a string. When a description is present, the intended format is `${Math.abs(realAmount)} ${description}`.

The template logic for composing the description from amount and source title is not yet implemented.

**Track**: Implement a description template in `buildHoneyMoneyTransaction` that produces `${Math.abs(normalizedAmount)} ${normalized.description}` when `normalized.description` is non-empty, falling back to just the amount string otherwise.

---

## 🟢 SUGGESTION — `z.any()` in `JsonLogicRuleSchema` (`config.ts:11`)

```ts
const JsonLogicRuleSchema = z.record(z.string(), z.any());
```

Styleguide: "Use `unknown` first when input shape is uncertain." Zod's `z.unknown()` preserves the structural constraint without widening to `any`. The type inference downstream stays the same (the value is `unknown` after parsing, requiring a cast before use), but it avoids promoting `any` through the config type tree.

---

## 🟢 SUGGESTION — Unnecessary optional chaining in `ruleEngine.ts:23`

```ts
jsonLogic.add_operation('is_owned', (account: string, bic: string | undefined, registry: AccountRegistry) => {
  return registry?.isOwned(account, bic);
});
```

`registry` is always provided via the evaluation context and typed as `AccountRegistry`. The `?.` is defensive but misleading — it implies `registry` can be absent. Use `registry.isOwned(account, bic)`.

---

## 🟢 SUGGESTION — VedPaymentIncome `is_owned` passes `null` BIC explicitly (`preview-VedPaymentIncome.test.ts:32`)

```ts
is_owned: [{ var: 'record.data.recipientAccountId' }, null, { var: 'accountRegistry' }]
```

Other record types pass `{ var: 'record.data.payerBankBic' }` as the BIC argument. `VedPaymentIncomeData` has no BIC field, so `null` is correct, but the inconsistency is a silent signal that the record type was handled differently. A comment in the rule (or in the spec) clarifying that VED records carry no BIC would prevent future confusion.
