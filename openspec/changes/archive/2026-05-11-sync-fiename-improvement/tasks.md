## 1. CLI Refactoring

- [x] 1.1 Remove `--out` option from `sync` command in `src/index.ts`
- [x] 1.2 Update `sync` command action to calculate standardized path `sync/[source]/[from]_[to].json`
- [x] 1.3 Update `npm run check` to ensure no linting/type errors

## 2. Core Implementation

- [x] 2.1 Update `writeOutput` in `src/output.ts` to handle path creation more robustly if needed (already mostly exists)
- [x] 2.2 Verify that `writeOutput` is called with the calculated standardized path in `src/index.ts`
- [x] 2.3 Run a test synchronization to verify file is created in `sync/tochka/YYYY-MM-DD_YYYY-MM-DD.json`

## 3. Cleanup

- [x] 3.1 Update `TECH-DEBT.md` to mark item 2 as completed
- [x] 3.2 Ensure `biome.json` rules are satisfied
