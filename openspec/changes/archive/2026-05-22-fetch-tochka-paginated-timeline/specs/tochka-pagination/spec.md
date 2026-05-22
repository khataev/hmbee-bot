## ADDED Requirements

### Requirement: Paginated Timeline Fetch
The Tochka adapter SHALL iteratively fetch timeline data if the number of returned records matches the requested page size.

#### Scenario: Single page response
- **WHEN** the adapter requests a page of data and receives fewer records than the `page_count`
- **THEN** the adapter SHALL return those records and terminate the sync process

#### Scenario: Multi-page response
- **WHEN** the adapter requests a page of data and receives exactly the `page_count` number of records
- **THEN** the adapter SHALL extract the `event_date` from the last record's `meta_data.time_data` and use it as `last_date` for the next request
- **THEN** it SHALL continue fetching until a page with fewer records than `page_count` is received

### Requirement: Schema Validation Error Messaging
The adapter SHALL throw a specific error message when the API response does not conform to the expected Zod schema.

#### Scenario: Schema mismatch
- **WHEN** the Tochka API returns data that fails Zod validation
- **THEN** the adapter SHALL throw a `TochkaError` with the message "Sync failed: Tochka timeline response does not match the expected schema"

### Requirement: Configurable Page Size
The adapter SHALL use a configurable page size for timeline requests.

#### Scenario: Production page size
- **WHEN** running in production mode
- **THEN** the `page_count` parameter SHALL be set to 250

#### Scenario: Testing page size
- **WHEN** running in test mode (or configured via environment)
- **THEN** the `page_count` parameter SHALL be set to 10
