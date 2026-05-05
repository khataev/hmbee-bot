## Why

Currently, the Tochka adapter only fetches a single page of timeline data. If the transactions for the requested period exceed the page size, data is lost. We need to implement pagination to ensure all data is synchronized. Additionally, we need to improve error reporting for schema mismatches.

## What Changes

- **Pagination logic**: Implement recursive or iterative fetching of timeline data when the result size matches the page size.
- **Pagination parameters**: Use `last_date` from the last item in the previous response to fetch the next page.
- **Error Handling**: Throw an explicit error "Sync failed: Tochka timeline response does not match the expected schema" when validation fails.
- **Configurable Page Size**: Use a testing page size of 10 and a production page size of 250.

## Capabilities

### New Capabilities
- `tochka-pagination`: Handles multi-page data retrieval from Tochka's JSON-RPC timeline endpoint.

### Modified Capabilities
- `source-sync`: Update error reporting and integration with paginated adapters.

## Impact

- `src/adapters/tochka.ts`: Implementation of pagination and schema error handling.
- `src/adapters/types.ts`: Potential updates to adapter interfaces if pagination state needs to be exposed.
