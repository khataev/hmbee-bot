## 1. CLI Refactoring

- [ ] 1.1 Remove `--out` option from `sync` command in `src/index.ts`
- [ ] 1.2 Update `sync` command action to calculate standardized path `sync/[source]/[from]_[to].json`
- [ ] 1.3 Update `npm run check` to ensure no linting/type errors

## 2. Core Implementation

- [ ] 2.1 Update `writeOutput` in `src/output.ts` to handle path creation more robustly if needed (already mostly exists)
- [ ] 2.2 Verify that `writeOutput` is called with the calculated standardized path in `src/index.ts`
- [ ] 2.3 Run a test synchronization to verify file is created in `sync/tochka/YYYY-MM-DD_YYYY-MM-DD.json`

## 3. Cleanup

- [ ] 3.1 Update `TECH-DEBT.md` to mark item 2 as completed
- [ ] 3.2 Ensure `biome.json` rules are satisfied
