# Senior Code Review

Date: 2026-05-10
Change: preview-normalized-income-expense

## Scope Reviewed

- Current unstaged changes:
  - README.md
  - openspec/changes/preview-normalized-income-expense/tasks.md
- Mandatory checks executed:
  - openspec list --json
  - npm audit --json
  - npm run check
  - Sensitive data keyword scan in src/ and src/adapters/

## Findings

### 🔴 CRITICAL

1. Style-guide violations remain while verification tasks are marked complete.
   - Evidence:
     - src/preview/loader.ts:8 uses Promise<any[]>
     - src/preview/tochka.ts:7 uses sourceRecord: any
   - Why critical:
     - STYLEGUIDE.md requires avoiding any and preferring unknown for uncertain inputs.
     - tasks.md marks quality verification complete (4.4, 5.2), but npm run check still reports these violations.
   - Required fix:
     - Replace any with unknown plus boundary validation and type narrowing.

### 🟡 WARNING

1. Non-null assertion bypasses safety checks.
   - Evidence:
     - src/preview/loader.ts:25 uses files[0]!
   - Risk:
     - Weakens fail-fast guarantees and can hide future logic regressions.
   - Recommended fix:
     - Use explicit runtime guard and remove non-null assertion.

2. README command now suggests nested output path that may fail on a clean workspace.
   - Evidence:
     - README.md now uses --out sync/tochka/data.json
     - src/output.ts writes directly with writeFileSync and does not create parent directories.
   - Risk:
     - If sync/tochka is missing, command fails with ENOENT.
   - Recommended fix:
     - Either document directory prerequisite, or create directories before write.

3. Category mapping remains hardcoded in code (documented technical debt).
   - Evidence:
     - src/preview/tochka.ts keeps MCC/description mappings in local objects/strings.
     - tasks.md 4.2 explicitly notes technical debt to move mapping to config.
   - Risk:
     - Higher maintenance cost and limited extensibility across sources.
   - Recommended fix:
     - Move mapping to config with schema validation and inject it into the adapter logic.

### 🟢 SUGGESTION

1. Add schema validation at preview input boundary.
   - Use Zod in preview loader/normalizer boundary so unknown input is validated once, then handled via typed data.

2. Promote repeated string literals to constants.
   - Status/type arrays and repeated category keys can be moved to named constants for readability and testability.

## Security & Audit Summary

- npm audit --json: no known vulnerabilities (0 total).
- Sensitive data scan:
  - No hardcoded token/cookie values detected in changed files.
  - src/adapters/tochka.ts uses TOCHKA_COOKIE from environment and parses X-CSRF-TOKEN at runtime; no literal secret values found.

## Conclusion

Review status: changes are not fully clean for closure due to style-guide violations still present in preview code paths.

Before finalizing this change, address the CRITICAL items and re-run npm run check.