## 1. Refactor TochkaAdapter for Pagination

- [x] 1.1 Update `TOCHKA_PAGE_SIZE` constant and make it configurable or set to 10 for initial testing.
- [x] 1.2 Refactor `sync` method in `src/adapters/tochka.ts` to use a loop for paginated fetching.
- [x] 1.3 Implement `fetchPage` helper method to encapsulate the single request logic.
- [x] 1.4 Implement logic to extract `event_date` from the last record to use as `last_date` in the subsequent request.
- [x] 1.5 Add termination condition: stop if `records.length < TOCHKA_PAGE_SIZE`.

## 2. Error Handling & Validation

- [x] 2.1 Update Zod validation block to throw "Sync failed: Tochka timeline response does not match the expected schema" on failure.
- [x] 2.2 Ensure all `TochkaError` categories are correctly assigned.

## 3. Configuration & Final Polish

- [x] 3.1 Change `TOCHKA_PAGE_SIZE` to 250 for production mode and update documention/.env.example.
- [x] 3.2 Verify implementation with `npm run check`.
- [ ] 3.3 Test with a mocked or real response containing multiple pages (if possible).
