## 1. Environment and Configuration

- [x] 1.1 Update `src/env.ts` to include `TOCHKA_CUSTOMER_ID` in `TochkaEnvSchema` and validation.
- [x] 1.2 Update [config/sources.json](config/sources.json) to remove `customerId`.
- [x] 1.3 Update `src/config.ts` to retrieve `customerId` from the validated environment instead of the JSON file.
- [x] 1.4 Add `TOCHKA_CUSTOMER_ID` to [.env](.env) (local only).

## 2. CLI Updates

- [x] 2.1 Add `--quiet` option to the `sync` command in `src/index.ts`.
- [x] 2.2 Update action handler in `src/index.ts` to conditionally suppress logs when `--quiet` is set.

## 3. Verification

- [x] 3.1 Run `npm run check` to ensure no lint or type errors.
- [x] 3.2 Verify `hmbee-bot sync tochka ... --quiet` outputs only JSON.
- [x] 3.3 Verify `validateTochkaEnv()` fails if `TOCHKA_CUSTOMER_ID` is missing.
