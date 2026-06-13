## ADDED Requirements

### Requirement: Preview command accepts --only-errors as a composable modifier
The `apply <source> --preview` command SHALL accept `--only-errors` as an optional boolean modifier. The modifier composes with `--preview` and applies a post-classification output filter; it has no effect on normalization, identification, or save logic.

#### Scenario: --only-errors is valid only in preview mode
- **WHEN** the operator provides `--only-errors` alongside `--preview`
- **THEN** the system applies the error filter to the classified preview records before writing output
- **AND** all other preview behaviour (normalization, mapping, hmbee branch, format) is unchanged

#### Scenario: --only-errors without --preview has no observable effect
- **WHEN** the operator provides `--only-errors` without `--preview`
- **THEN** the system proceeds with the normal apply flow
- **AND** no error or warning is raised for the unused flag
