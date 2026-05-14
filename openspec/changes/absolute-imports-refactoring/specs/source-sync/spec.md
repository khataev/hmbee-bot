## ADDED Requirements

### Requirement: Source-sync implementation MUST follow absolute import policy
The source-sync implementation SHALL use absolute import paths for internal module references in the enforced TypeScript source scope.

#### Scenario: Sync module import style is compliant
- **WHEN** source-sync files are validated under lint rules
- **THEN** internal imports in the enforced scope use absolute paths
- **AND** no relative import policy violations are reported
