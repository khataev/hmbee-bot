## Context

The `sync` command currently allows arbitrary output paths via the `--out` flag. This creates friction for the `apply` command, which needs to know where sync files are located to process them. The `TECH-DEBT.md` (Item 2) identifies this as a point of improvement to reduce operator overhead and improve pipeline predictability.

## Goals / Non-Goals

**Goals:**
- Eliminate the `--out` flag to reduce complexity.
- Enforce a standard directory structure: `sync/[source]/`.
- Enforce a standard naming convention: `[from]_[to].json`.
- Ensure the synchronization pipeline is predictable for downstream commands.

**Non-Goals:**
- Changing the internal data format of the sync files (handled by other tasks).
- Supporting custom templates for filenames.

## Decisions

### 1. Remove `--out` flag
- **Rationale**: The flag introduces unnecessary variation. Removing it simplifies the CLI interface and ensures all sync data is stored in the designated project structure.
- **Alternatives**: 
    - Keeping the flag as optional (rejected because the goal is standardization).
    - Making `--out` a directory instead of a file (rejected because the directory structure should also be standardized).

### 2. Standard Filename: `sync/[source]/[from]_[to].json`
- **Rationale**: This format clearly identifies the data source and the time range covered by the synchronization, which are the primary metadata needed for discovery.
- **Implementation**: 
    - Use `ISO 8601` basic format (`YYYY-MM-DD`) for dates.
    - Path logic will be centralized to ensure consistency between `sync` and future `apply` discovery logic.

### 3. Automatic Directory Creation
- **Rationale**: The operator shouldn't have to manually create `sync/tochka/` folders. The tool will use `fs.mkdirSync(..., { recursive: true })` or equivalent.

## Risks / Trade-offs

- **[Risk]** Breaking existing scripts that rely on `--out`. 
    - **Mitigation**: This is a breaking change. It should be clearly communicated in the CLI as it is a transition phase towards a more managed pipeline.
- **[Risk]** Overwriting existing files if `from` and `to` are identical.
    - **Mitigation**: This is generally desired behavior for a "sync" operation if the period is identical, but we could add a warning if needed (out of scope for now).

## Engineering Constraints
- Use absolute paths for file system operations derived from the project root.
- Ensure type safety for date strings used in filenames.
- Error handling: provide clear messages if directory creation/write fails (e.g., permission issues).
