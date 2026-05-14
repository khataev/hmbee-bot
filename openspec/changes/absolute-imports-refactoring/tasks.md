## 1. Import Policy Setup

- [ ] 1.1 Confirm and finalize TypeScript absolute import alias configuration for enforced source scope
- [ ] 1.2 Configure Biome `noRestrictedImports` to reject `./**` and `../**` relative imports in targeted source files
- [ ] 1.3 Validate policy setup and baseline configuration with `npm run check`

## 2. Source Migration

- [ ] 2.1 Refactor internal imports in source-sync modules to absolute alias-based imports
- [ ] 2.2 Refactor internal imports in source-preview modules to absolute alias-based imports
- [ ] 2.3 Refactor internal imports in source-apply modules to absolute alias-based imports
- [ ] 2.4 Validate migrated imports and type/lint integrity with `npm run check`

## 3. Safeguards And Verification

- [ ] 3.1 Add or update tests/fixtures only where needed to preserve behavior while imports change
- [ ] 3.2 Verify `npm run check` passes with policy enabled and no relative-import violations
- [ ] 3.3 Document migration scope and enforcement notes in change-related docs or PR context
