# Code Review — hmb-description-from-mapping

## Summary

All checks pass: `npm audit` (0 vulnerabilities), `npm run typecheck`, `npm run lint`. No hardcoded secrets or sensitive tokens found.

---

## 🟡 WARNING

### W1 — `CategoryMapping` interface duplicates Zod-derived type

**File:** `src/apply/preview/tochka.ts:4-9`

```typescript
export interface CategoryMapping {
  mcc: Record<string, MappingEntry>;
  title: Record<string, MappingEntry>;
  ignored: { mcc: string[]; title: string[] };
}
```

Style guide: *"If a runtime schema already exists (for example, Zod), derive TypeScript types from that schema (`z.infer`) instead of duplicating shape definitions manually."* The shape is already captured in `categoryMappingSchema` in `config.ts`. This interface is a manual duplicate that will drift if the schema changes.

**Fix:** Export the inferred type from `config.ts` and import it in `tochka.ts`:
```typescript
// config.ts
export type CategoryMapping = z.infer<typeof categoryMappingSchema>;
```

---

### W2 ✅ — `ResolvedHmbeeConfigSchema` duplicates `categoryMappingSchema` inline

**File:** `src/config.ts:63-74`

```typescript
const ResolvedHmbeeConfigSchema = z.object({
  currenciesMapping: z.record(z.string(), z.string()),
  categoryMapping: z.object({           // ← duplicates categoryMappingSchema
    mcc: z.record(z.string(), MappingEntrySchema),
    title: z.record(z.string(), MappingEntrySchema),
    ignored: ignoredMappingSchema
  })
});
```

`categoryMappingSchema` already defines this exact structure. The inline definition will diverge silently.

**Fix:** Reuse the existing schema:
```typescript
categoryMapping: categoryMappingSchema
```

---

### W3+W4 — Regex compiled on every call; invalid patterns crash at runtime

**Files:** `src/apply/preview/tochka.ts:687-689`, `src/config.ts`

```typescript
for (const [pat, entry] of Object.entries(categoryMapping.title)) {
  if (new RegExp(pat, 'i').test(description)) {
```

Two problems with the same root cause:

1. `new RegExp(pat, 'i')` is recompiled on every call for every transaction.
2. An invalid regex string in `categoryMapping.title` (e.g. from a malformed `sources.json`) throws an uncaught `SyntaxError` during normalization, crashing mid-run with no useful context.

**Fix:** Pre-compile title patterns in `loadConfig()` and fail fast with a clear error if a pattern is invalid. Change the resolved `title` type from `Record<string, MappingEntry>` to `Array<{ pattern: RegExp; entry: MappingEntry }>` — a sequence of pairs that correctly represents "iterate and test", without implying O(1) key lookup (which `RegExp` can't provide anyway):

```typescript
// in loadConfig()
const titlePatterns = Object.entries(raw.hmbee.categoryMapping.title).map(([pat, entry]) => {
  try {
    return { pattern: new RegExp(pat, 'i'), entry };
  } catch {
    throw new Error(`Invalid regex pattern in categoryMapping.title: "${pat}"`);
  }
});
```

```typescript
// in mapTochkaCategory
for (const { pattern, entry } of categoryMapping.title) {
  if (pattern.test(description)) return entry;
}
```

W1 becomes a follow-on: `CategoryMapping` in `tochka.ts` should reflect the resolved shape (compiled title), not the raw config shape.

---

### W5 — `ignored` field passed into normalization but never consulted

**File:** `src/apply/preview/tochka.ts:8, 678-694`

`CategoryMapping.ignored` is carried into `mapTochkaCategory` via the `categoryMapping` parameter but the function never reads it. Entries in `ignored` don't appear in `mcc` or `title` maps so they naturally return `null` — the field is dead weight in the production code path.

If `ignored` is only meaningful for the interactive script (to avoid re-prompting), it should be excluded from the type passed to `normalizeTochkaRecord` and `mapTochkaCategory`. This makes the boundary explicit and prevents confusion about whether the normalization layer is supposed to honour it.

---

## 🟢 SUGGESTION

### S1 — `ignored` section absent from `config/sources.example.json`

**File:** `config/sources.example.json`

The `categoryMapping` example documents `mcc` and `title` but omits `ignored`. A user reading the example file won't know the capability exists. Add at least one entry:

```json
"ignored": {
  "mcc": [],
  "title": ["SOME_PATTERN"]
}
```

---

### S2 — Dot in `TIMEWEB.CLOUD` title pattern is unescaped

**File:** `config/sources.example.json`

`"TIMEWEB.CLOUD"` as a regex pattern matches any character in place of `.` (e.g. `TIMEWEB_CLOUD`). If literal-match semantics are intended, escape the dot: `"TIMEWEB\\.CLOUD"`. The script's `validateAndGetPattern` won't catch this because `TIMEWEB.CLOUD` self-matches as a regex.

---

## Verdict

No blockers. The most impactful fix is **W3+W4** (pre-compile title regexes at config load — eliminates repeated compilation and turns config errors into a startup failure with a clear message). **W1+W2** prevent schema drift. The rest are quality improvements.
