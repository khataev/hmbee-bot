## ADDED Requirements

### Requirement: Source-preview implementation MUST follow absolute import policy
The source-preview implementation SHALL use absolute import paths for internal module references in the enforced TypeScript source scope.

#### Scenario: Preview module import style is compliant
- **WHEN** source-preview files are validated under lint rules
- **THEN** internal imports in the enforced scope use absolute paths
- **AND** no relative import policy violations are reported
