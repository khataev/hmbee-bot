## ADDED Requirements

### Requirement: Cache update is triggered by the apply command
The system SHALL update the Honey Money cache from the `apply <source>` command before the manual-entry skip pass, on every run including preview modes, unless the operator passes `--skip-hmbee-cache-update`. The cache update SHALL reuse the fetch-and-trim behavior of this capability, using the sync file's start date as the trimming boundary.

#### Scenario: Apply updates the cache by default
- **WHEN** the operator runs `apply <source>` without `--skip-hmbee-cache-update`
- **THEN** the system fetches Honey Money transactions and writes the trimmed cache before the skip pass

#### Scenario: Cache is not touched under the opt-out flag
- **WHEN** the operator runs `apply <source> --skip-hmbee-cache-update`
- **THEN** the system does not fetch Honey Money transactions
- **AND** the existing Honey Money cache file is left unchanged

## MODIFIED Requirements

### Requirement: Honey Money cache is written with date trimming
The system SHALL persist the fetched Honey Money transactions to a local cache file, keeping only records dated on or after the sync window start minus a fixed lookback. The sync window start is the `<from>` date derived from the active sync file name.

#### Scenario: Trim and write the cache
- **WHEN** the system updates the Honey Money cache for a sync window whose start date is `from`
- **THEN** the system keeps only Honey Money records with `date >= (from − 10 days)`
- **AND** the system writes the kept records to `sync/hmbee/all_json_cache.json`
- **AND** the file is overwritten on each cache update

#### Scenario: Cache directory is created when missing
- **WHEN** the cache is written and the `sync/hmbee/` directory does not exist
- **THEN** the system creates the directory before writing the cache file

## REMOVED Requirements

### Requirement: Cache update is triggered from the sync command flag
**Reason**: Обновление кэша переносится в команду `apply` (форсированный refresh перед skip-pass). `sync` больше не инициирует обновление HM-кэша.
**Migration**: Обновление кэша происходит автоматически при `apply <source>`; отключается через `apply <source> --skip-hmbee-cache-update`. Прежний путь `sync <source> --update-hmbee-cache` удалён.
