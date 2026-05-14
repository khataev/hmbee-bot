## ADDED Requirements

### Requirement: Source modules MUST use absolute imports
The system SHALL define and enforce an absolute import policy for TypeScript source modules in the project scope, and SHALL reject relative path imports in that scope.

#### Scenario: Relative import is rejected by lint
- **WHEN** a source file under the enforced scope contains an import path matching `./**` or `../**`
- **THEN** lint fails with an error explaining that absolute imports are required

### Requirement: Absolute import policy MUST be continuously verifiable
The system SHALL include the import policy in standard quality gates so violations are detected in regular validation runs.

#### Scenario: Quality check validates policy
- **WHEN** the operator runs the project validation command (`npm run check`)
- **THEN** the import policy is evaluated as part of lint checks
- **AND** the command exits non-zero if policy violations exist
