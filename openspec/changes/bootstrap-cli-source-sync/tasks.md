## 1. CLI bootstrap

- [ ] 1.1 Create the initial CLI entrypoint and command dispatch structure for local execution
- [ ] 1.2 Add the `list` command for supported data sources
- [ ] 1.3 Add the `sync` command interface with source selection and period input handling

## 2. Environment and configuration

- [ ] 2.1 Add local environment loading and validation for source adapter secrets
- [ ] 2.2 Add the initial project configuration shape for source-specific non-secret settings
- [ ] 2.3 Add a `.env.example` document for the first source adapter inputs

## 3. Source adapter foundation

- [ ] 3.1 Define the initial data source adapter contract used by the CLI sync flow
- [ ] 3.2 Implement the Tochka adapter request flow using the current manual session-based credentials
- [ ] 3.3 Parse and return the Tochka timeline response as the sync result shape used by the CLI

## 4. Sync output and validation

- [ ] 4.1 Add sync output controls for `--format` and `--out` with adapted output as the default
- [ ] 4.2 Validate failure cases for unsupported source names and missing required environment variables
- [ ] 4.3 Validate the `list` command output and sync output destination behavior
- [ ] 4.4 Document how to run the `list` and `sync` commands locally against Tochka example data and real session credentials