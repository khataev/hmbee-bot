## Context

The codebase currently mixes relative and absolute-style imports, creating inconsistent module boundaries and making refactors noisier. This change standardizes imports in TypeScript runtime and test modules so path intent remains stable when files move.

The proposal introduces one new capability (`absolute-imports-policy`) and modifies three existing capabilities (`source-sync`, `source-preview`, `source-apply`) only at implementation level (no runtime behavior changes).

## Goals / Non-Goals

**Goals:**
- Establish a single absolute import convention for targeted TypeScript files.
- Migrate existing relative imports to absolute alias-based imports.
- Enforce the convention with Biome (`noRestrictedImports`) so relative imports fail lint checks.
- Keep runtime behavior identical and preserve CLI/API contracts.

**Non-Goals:**
- No functional redesign of sync/preview/apply flows.
- No changes to external data contracts, output formats, or API semantics.
- No broad monorepo-level package boundary redesign.

## Decisions

1. Use TypeScript path aliases as the source of truth for absolute import resolution.
- Rationale: Keeps compile-time resolution explicit and avoids brittle deep relative paths.
- Alternative considered: Keep relative imports and enforce shallow path depth. Rejected because it still preserves path-fragility during file moves.

2. Enforce relative-import prohibition through Biome `noRestrictedImports` patterns.
- Rationale: One-tool quality gate aligns with existing Biome-only lint/format setup.
- Alternative considered: ESLint-only enforcement. Rejected to avoid dual-tool maintenance.

3. Apply migration incrementally to the current source surface (`src/**`) with strict check gate.
- Rationale: Limits risk and keeps review scope tractable while covering the core runtime modules.
- Alternative considered: All files in one sweep including docs/scripts. Rejected due to lower value and higher churn.

4. Keep changes behavior-preserving and validated by existing checks/tests.
- Rationale: This is a maintainability refactor; regression risk should be isolated to module resolution only.
- Alternative considered: Bundle with broader cleanup. Rejected to keep rollback simple.

## Engineering Constraints

- Type safety: Maintain strict TypeScript compatibility; no new `any`-based escapes.
- Error handling: Preserve current error propagation and output behavior in CLI flows.
- Module boundaries: Do not create cyclic imports when converting to absolute paths.
- Style/lint impact: New and migrated imports must satisfy Biome formatting and lint rules, including `noRestrictedImports`.

## Risks / Trade-offs

- [Risk] Alias misconfiguration can break runtime/module resolution. → Mitigation: validate `tsconfig.json` alias coverage and run `npm run check`.
- [Risk] Overly broad restricted-import patterns may block valid same-folder local utilities. → Mitigation: scope rule to intended file set and refine exceptions only if justified.
- [Risk] Large import churn may reduce review clarity. → Mitigation: keep refactor mechanical and avoid unrelated edits.

## Migration Plan

1. Confirm or add stable alias mappings in TypeScript config.
2. Convert existing relative imports in targeted source files to alias-based absolute imports.
3. Enable/adjust Biome `noRestrictedImports` rule for relative path bans.
4. Run `npm run check` and fix any import-resolution or lint failures.
5. If regressions appear, rollback by reverting import rewrite + rule change in a single commit.

## Open Questions

- Should test files follow the same strict import policy immediately, or phase them in after runtime sources?
- Do we need narrow allowlists for specific local-relative cases (for example, generated fixtures)?
