## ADDED Requirements

### Requirement: Sync removes the previous sync file before writing
The system SHALL, when writing sync output to the standardized file path, first remove any other `*.json` files in `sync/<source>/` so that exactly one sync file remains for the source. This cleanup SHALL apply only in file-output mode; when the operator uses `--stdout`, the system SHALL NOT modify the `sync/<source>/` directory. The cleanup SHALL be scoped to the `sync/<source>/` directory and MUST NOT affect the `sync/hmbee/` cache directory.

#### Scenario: Previous sync file is replaced
- **WHEN** the operator runs sync for a source and period while `sync/<source>/` already contains a sync file from a previous run
- **THEN** the system removes the previous `*.json` file(s) in `sync/<source>/`
- **AND** the system writes the new sync file so that exactly one sync file remains

#### Scenario: Stdout mode does not touch the directory
- **WHEN** the operator runs sync with `--stdout`
- **THEN** the system does not remove or write any file in `sync/<source>/`

#### Scenario: Cache directory is not affected
- **WHEN** the system cleans up previous sync files in `sync/<source>/`
- **THEN** the `sync/hmbee/` cache directory and its contents are left unchanged

## REMOVED Requirements

### Requirement: Sync command exposes an optional Honey Money cache update flag
**Reason**: Ответственность за обновление HM-кэша переносится в команду `apply`, которая форсит refresh перед skip-pass. Флаг `--update-hmbee-cache` на `sync` становится избыточным, а `sync` перестаёт обращаться к Honey Money.
**Migration**: Больше не использовать `sync --update-hmbee-cache`. Кэш обновляется автоматически при `apply <source>`; для пропуска обновления использовать `apply <source> --skip-hmbee-cache-update`.
