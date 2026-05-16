## 1. Rule Engine Boundary

- [x] 1.1 Add `json-logic-js` and introduce a project-local preview rule-engine interface that evaluates boolean `included` and `excluded` predicates without changing current preview semantics
- [x] 1.2 Migrate the existing flat `CardTransactionInfo` preview rules to equivalent JSON Logic expressions in `config/sources.json`
- [x] 1.3 Add focused tests proving include-only, exclude-only, ambiguity, and no-match outcomes remain unchanged after the rule-format migration
- [x] 1.4 Validate this stage with focused tests and `npm run check`
- [x] 1.5 Stop for review before continuing

## 2. Change Closeout

- [x] 2.1 Confirm the migration remains limited to replacing the rule format and does not add helper-data plumbing or new transaction-family behavior
- [x] 2.2 Update the review record in `openspec/changes/refactor-preview-conditions-to-json-logic/review.md` after implementation review