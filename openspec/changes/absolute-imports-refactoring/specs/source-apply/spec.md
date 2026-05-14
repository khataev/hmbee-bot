## ADDED Requirements

### Requirement: Source-apply implementation MUST follow absolute import policy
The source-apply implementation SHALL use absolute import paths for internal module references in the enforced TypeScript source scope.

#### Scenario: Apply module import style is compliant
- **WHEN** source-apply files are validated under lint rules
- **THEN** internal imports in the enforced scope use absolute paths
- **AND** no relative import policy violations are reported
