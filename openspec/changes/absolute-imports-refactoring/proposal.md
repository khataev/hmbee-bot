## Why

Relative imports are currently used across the codebase, which makes refactors and file moves error-prone and reduces consistency in module boundaries. We need a single import policy with automated enforcement so new relative imports do not reappear.

## What Changes

- Introduce a project-level absolute import convention for runtime source files.
- Refactor existing TypeScript source imports from relative paths to absolute alias-based paths.
- Configure and enforce a Biome rule (`noRestrictedImports`) that rejects relative imports (`./**`, `../**`) in the targeted source scope.
- Document migration scope and validation criteria, including `npm run check` as a quality gate.

## Capabilities

### New Capabilities
- `absolute-imports-policy`: Define and enforce an absolute-import-only policy for TypeScript source modules, including lint-level prevention of new relative imports.

### Modified Capabilities
- `source-sync`: Update source-sync implementation files to follow the absolute import policy without changing sync behavior.
- `source-preview`: Update preview pipeline files to follow the absolute import policy without changing preview behavior.
- `source-apply`: Update apply pipeline files to follow the absolute import policy without changing apply behavior.

## Impact

- Affected code: TypeScript source files under `src/**` and related module import statements.
- Affected configuration: `biome.json` and any import-resolution assumptions in tests.
- APIs/behavior: No intended runtime behavior changes; this is a maintainability and consistency refactor.
- Quality validation: `npm run check` must pass after migration, and Biome must error on newly introduced relative imports in scoped source files.
