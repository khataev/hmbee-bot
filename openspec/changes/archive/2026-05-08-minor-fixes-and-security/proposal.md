## Why

The current configuration stores sensitive information (`customerId`) in a plain JSON file in the repository, which is a security risk. Additionally, the CLI outputs informational messages that interfere with programmatic usage when only the raw data is needed.

## What Changes

- **Move Sensitive Config to Environment**: Relocate `customerId` from `config/sources.json` to environment variables (`.env`).
- **Add Quiet Mode to CLI**: Introduce a `--quiet` flag to the `sync` command to suppress non-data output, allowing for clean JSON processing.

## Capabilities

### New Capabilities
- `cli-output-control`: Capability to suppress informational logging for cleaner stdout.
- `secure-config-management`: Ability to manage sensitive source configuration through environment variables instead of versioned files.

### Modified Capabilities
- `source-sync`: Update synchronization logic to correctly handle configuration from environment variables.

## Impact

- `src/index.ts`: Updated to support `--quiet` flag and respect it in logging.
- `src/config.ts`: Updated to read `customerId` from validated environment variables.
- `src/env.ts`: Updated to include and validate `TOCHKA_CUSTOMER_ID`.
- `config/sources.json`: Removed `customerId`.
- `.env`: Added `TOCHKA_CUSTOMER_ID`.
