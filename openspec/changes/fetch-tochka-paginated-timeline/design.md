## Context

The `TochkaAdapter` currently performs a single `POST` request to the Tochka timeline API. This API returns a list of transactions (`time_line_list`) for a given period. If the transactions exceed the `page_count`, only the first page is returned. To fetch subsequent pages, a `last_date` parameter must be provided in the request body, derived from the timestamp of the last record in the previous response.

Current Implementation:
- Single request architecture.
- Default `page_count` of 50.
- Minimal error messaging for schema mismatches.

## Goals / Non-Goals

**Goals:**
- Implement an iterative/recursive fetch loop in `TochkaAdapter.sync`.
- Use `result.time_line_list[N-1].meta_data.time_data.event_date` as `last_date` for the next request.
- Terminate when `records.length < page_count` or the next page is empty.
- Improve error handling to throw "Sync failed: Tochka timeline response does not match the expected schema" on Zod validation failure.
- Support a configurable `TOCHKA_PAGE_SIZE` (default 250 for prod, 10 for testing).

**Non-Goals:**
- Parallelizing page requests (unsuitable since `last_date` is sequential).
- Handling complex rate limiting beyond basic error reporting.

## Decisions

### 1. Loop Implementation: Iterative while-loop
- **Rationale**: Iteration is safer for memory and easier to debug than recursion for a large number of pages.
- **Mechanism**:
  ```typescript
  let allRecords = [];
  let lastDate: string | undefined = undefined;
  while (true) {
    const page = await this.fetchPage(..., lastDate);
    allRecords.push(...page.records);
    if (page.records.length < TOCHKA_PAGE_SIZE) break;
    lastDate = page.records[page.records.length - 1].meta_data.time_data.event_date;
  }
  ```

### 2. Error Handling: Explicit Schema Mismatch Message
- **Rationale**: The user requested a specific error string for validation failures to help with debugging adaptation changes.
- **Mechanism**: Update `TochkaError` message in the `safeParse` block.

### 3. Page Size Configuration
- **Rationale**: `TOCHKA_PAGE_SIZE` should be easily toggleable.
- **Decision**: Define as a constant/variable in `tochka.ts`, initialized to 250 by default but can be overridden during tests if needed (though `dotenv` or config is preferred).

## Risks / Trade-offs

- **[Risk] Infinite Loop** → **[Mitigation]** Add a safety break (e.g., max 100 pages) and ensure `lastDate` actually changes or the result set shrinks.
- **[Risk] Large Memory Usage** → **[Mitigation]** While 250 records per page is small, many pages could consume memory. For now, we collect all in memory as per `SyncResult` structure.

## Engineering Constraints
- Use `z.infer<typeof TochkaTransactionSchema>` for type safety.
- Maintain `TochkaError` as the primary exception type.
- Ensure `Biomes` linting passes.
