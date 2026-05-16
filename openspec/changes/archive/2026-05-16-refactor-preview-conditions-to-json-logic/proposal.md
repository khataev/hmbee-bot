## Why

The current preview condition format only supports flat field equality checks, which is already too narrow for upcoming SBP preview cases such as `SbpB2CPayment` where account-registry-aware predicates are needed. The condition engine needs a more expressive JSON-based rule format before support for additional Tochka transaction families can be implemented safely.

This change updates preview decision rules only. Semantic transaction classification such as transfer vs income vs expense remains in code so the configuration layer stays focused on preview inclusion semantics rather than broader transaction interpretation.

## What Changes

- Replace the current flat `included` and `excluded` condition objects with JSON-based boolean expressions for preview decision rules.
- Implement those expressions through `json-logic-js`, wrapped by a project-local adapter.
- Preserve the existing preview decision contract and ambiguity semantics: include-only match, exclude-only match, ambiguity, and no-match.
- Keep semantic transaction classification out of configuration; config-driven logic in this change applies only to preview decision rules.
- Introduce staged implementation steps with a mandatory stop for review after each step before continuing.
- Validate the refactor with focused tests and `npm run check` so rule migration does not regress current preview behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `source-preview`: Preview classification rules move from flat field-match conditions to JSON expression predicates while preserving the existing `identified` / `save` / `reason` decision model.

## Impact

- Affected code: preview rule evaluation, Tochka preview normalization, config loading/validation, and focused preview tests.
- Affected inputs: `config/sources.json` preview rule definitions will move to the new JSON expression format.
- Affected dependencies: the project will add `json-logic-js` as the expression evaluator behind a local preview rule adapter.
- Quality constraints: the rule engine must remain deterministic, side-effect-free, and easy to review; semantic transaction classification must remain outside configuration; this change is limited to equivalent rule migration with no new helper-data plumbing; every implementation step must end with an explicit review stop and validation via `npm run check` before the next step begins.