## Context

The current preview classifier in [src/apply/preview/tochka.ts](/Users/khataev/Documents/code/hmbee-bot/src/apply/preview/tochka.ts) evaluates `included` and `excluded` rules as flat field-equality objects loaded from [config/sources.json](/Users/khataev/Documents/code/hmbee-bot/config/sources.json). That shape is sufficient for the current `CardTransactionInfo` slice, but the project has decided to standardize preview rules on `json-logic-js` before adding more complex rule families.

At the same time, the repository has already established two separate concerns that should not be merged:
- preview decision semantics: `identified`, `save`, `reason`, plus ambiguity handling
- semantic transaction interpretation: transfer vs income vs expense

This change only addresses the first concern. The rule engine format changes, but semantic transaction classification remains in code so that configuration stays bounded to preview decision logic.

## Goals / Non-Goals

**Goals:**
- Replace flat preview rule conditions with JSON-based boolean predicates.
- Preserve the current preview decision contract and `included/excluded ambiguity` semantics.
- Keep semantic transaction classification outside configuration.
- Keep the scope limited to equivalent migration of existing preview rules.
- Roll out the refactor in reviewable steps, with an explicit stop for review after each implementation step.

**Non-Goals:**
- Implementing SBP preview support in this change.
- Moving transfer detection or income/expense classification into configuration.
- Designing full transfer pairing logic in this change.
- Adding cached account-registry data or other helper-data plumbing for future rules.
- Introducing save-time or API-failure states into preview.

## Decisions

### Decision: Use `json-logic-js` behind a local rule-engine boundary
Preview rule definitions will move from arrays of field-equality objects to `json-logic-js` expressions evaluated through a small local adapter layer. The rest of the preview pipeline should depend on a project-owned evaluation interface rather than on the third-party library directly.

Rationale:
- Satisfies the requirement to use a JSON-native expression format with an existing library rather than inventing a custom DSL.
- `json-logic-js` already provides boolean composition, field access, and custom operations in a format that fits checked-in JSON configuration.
- Limits the blast radius if the chosen library needs custom operators or replacement later.
- Makes tests focus on repo behavior instead of third-party implementation details.

Alternative considered:
- Call a third-party expression library directly from preview normalization code. Rejected because it would couple preview classification, config parsing, and library-specific APIs too tightly.

Implementation shape for this decision:
- `config/sources.json` stores `included` and `excluded` as JSON Logic expressions rather than arrays of flat condition objects.
- Config parsing validates these values as JSON objects/arrays accepted by the project adapter, not as arbitrary executable code.
- A local preview-rule module is responsible for calling `jsonLogic.apply(...)` and coercing the result to a boolean.
- Custom operators are registered in one place through the local adapter rather than ad hoc inside preview normalization.
- The adapter receives a typed evaluation payload containing the source record only for this change.

### Decision: Preserve separate include and exclude channels, each producing a boolean result
The new rule format will still expose two independently evaluated predicates per known `type_code`: `included` and `excluded`. Each predicate resolves to a boolean for a given source record and evaluation context.

Rationale:
- Preserves the current preview contract and existing operator mental model.
- Keeps ambiguity detection unchanged: both booleans true remains a classification failure.
- Avoids overloading a single expression with multiple outcome branches.

Alternative considered:
- Replace include/exclude with a single multi-branch expression returning outcome enums. Rejected because it would merge preview decision semantics with rule authoring complexity and make ambiguity harder to reason about.

Equivalent migration examples:

Current flat rule:
```json
{ "tranCode": "Purchase", "status": "Withdraw" }
```

Migrated JSON Logic rule:
```json
{
	"and": [
		{ "==": [{ "var": "record.data.tranCode" }, "Purchase"] },
		{ "==": [{ "var": "record.data.status" }, "Withdraw"] }
	]
}
```

Top-level preview rule shape:
```json
{
	"included": {
		"or": [
			{
				"and": [
					{ "==": [{ "var": "record.data.tranCode" }, "Purchase"] },
					{ "==": [{ "var": "record.data.status" }, "Withdraw"] }
				]
			},
			{
				"and": [
					{ "==": [{ "var": "record.data.tranCode" }, "Purchase"] },
					{ "==": [{ "var": "record.data.status" }, "InProgress"] }
				]
			}
		]
	},
	"excluded": {
		"or": [
			{ "==": [{ "var": "record.data.tranCode" }, "CheckCard"] },
			{
				"and": [
					{ "==": [{ "var": "record.data.tranCode" }, "Purchase"] },
					{ "==": [{ "var": "record.data.status" }, "Canceled"] }
				]
			}
		]
	}
}
```

### Decision: Semantic transaction classification remains in code
Config-driven expressions in this change apply only to preview decision rules. Transfer detection and future income/expense interpretation continue to be computed in TypeScript code outside the configuration DSL.

Rationale:
- Matches the intended boundary between configurable preview inclusion logic and source-specific transaction semantics.
- Keeps config readable and reviewable.
- Prevents early drift toward a second general-purpose business-logic engine.

Alternative considered:
- Encode transfer and transaction-kind semantics directly in configuration. Rejected because the current need is narrower and the semantic pipeline is better expressed and tested in code.

### Decision: Keep the first migration limited to source-record-only evaluation
For this change, the rule engine will evaluate predicates against a typed payload containing only the source record. Helper data and custom operators for future SBP-specific rules are explicitly deferred.

Rationale:
- Keeps the migration scope limited to format replacement rather than behavior expansion.
- Makes equivalence with current flat conditions easier to verify.
- Avoids introducing speculative plumbing that is not yet used.

Alternative considered:
- Add helper-data plumbing now for future account-registry-aware rules. Rejected because the user explicitly wants this change to stay a pure `json-logic-js` migration.

### Decision: Migrate in narrow stages with mandatory review stops
Implementation will be split into discrete stages, and each stage ends with validation plus an explicit stop for human review before the next stage begins.

Proposed stages:
1. Introduce the project-local rule-engine boundary around `json-logic-js` and migrate current flat conditions to equivalent JSON Logic predicates without changing supported behavior.
2. Keep evaluation limited to the source record and prove equivalence with current include/exclude semantics through focused tests.
3. Stop and review before any future change adds helper data or custom operators.

Rationale:
- Keeps the refactor reviewable.
- Makes regressions easier to localize.
- Aligns the change process with the requested stop-for-review workflow.

Alternative considered:
- Migrate the rule engine and add SBP support in one pass. Rejected because it would combine infrastructure change with behavior expansion and make review weaker.

## Risks / Trade-offs

- [Risk] A more expressive rule format can become too powerful and start absorbing semantic classification logic. -> Mitigation: keep the project-owned evaluation interface narrow and explicitly exclude transaction semantics from config.
- [Risk] `json-logic-js` is flexible enough to encourage overly complex config expressions. -> Mitigation: keep authoring conventions narrow, prefer simple boolean predicates, and keep semantic transaction classification in code.
- [Risk] Adding a third-party expression library introduces dependency and maintenance overhead. -> Mitigation: hide `json-logic-js` behind a local adapter and keep the project-facing contract replaceable.
- [Risk] Migration may accidentally change existing `CardTransactionInfo` behavior. -> Mitigation: first migrate by equivalence, keep fixture-backed tests, and require `npm run check` before each review stop.
- [Risk] The migration may accidentally introduce extra abstraction that is unused by current rules. -> Mitigation: keep the first adapter narrow and source-record-only.

## Migration Plan

No production migration is required. This is a preview-only configuration and evaluation refactor.

Implementation rollout:
1. Add the rule-engine abstraction around `json-logic-js` and convert the current preview rules to the new expression format.
2. Add tests proving the migrated rules preserve current include/exclude/ambiguity behavior.
3. Re-run focused tests and `npm run check`.
4. Stop for review.

Rollback strategy:
- Revert the new rule-engine adapter and restore the flat condition evaluator.
- Restore the previous config shape if the `json-logic-js` format proves too costly or unclear.

## Open Questions

- Should the migrated config format allow only boolean predicate nodes, or also a limited macro/preprocessing layer for readability in a later change?
- What is the smallest later change that should introduce helper data or custom predicates for SBP support?

## Engineering Constraints

- Preserve strict TypeScript typing for config parsing, evaluation context, and rule results.
- Keep rule evaluation side-effect-free: no filesystem access, network access, or hidden config reloads during predicate execution.
- Keep module boundaries explicit: config loading parses JSON Logic rules, the rule-engine adapter evaluates predicates, and preview normalization consumes boolean outcomes.
- Use informative validation errors for malformed rule expressions and unsupported operators without leaking secrets.
- Keep any new modules small and aligned with the existing Biome and TypeScript style baseline; avoid introducing helper-data plumbing or a broad framework around the rule engine in this change.
- Treat style and lint impact as part of the rollout: if a new dependency or adapter pattern changes project conventions, cover it with focused tests and `npm run check` before each review stop.