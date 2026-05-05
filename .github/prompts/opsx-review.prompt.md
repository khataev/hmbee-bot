---
description: Perform a deep code review based on project style and security standards
---

Perform a senior-level code review of the current changes.

**Input**: 
- Optionally specify a change name: `/opsx:review <change-name>`.
- Optionally specify a GitHub PR URL: `/opsx:review <pr-url>`.

## Steps

1. **Information Gathering**
   - Read [STYLEGUIDE.md](STYLEGUIDE.md) to understand project standards.
   - Run `openspec list --json` to identify the active change if not provided.
   - If a GitHub PR URL is provided, use `pullRequestInViewport` to get PR context and comments.
   - Identify files changed in the target `change/task` or PR.

2. **Security & Audit**
   - **Critical**: Check for hardcoded secrets, tokens, or sensitive cookies (especially in `src/adapters/`).
   - Run `npm audit` in the terminal to check for dependency vulnerabilities. If vulnerabilities are found, mark them as CRITICAL.

3. **Style compliance (Ref: STYLEGUIDE.md)**
   - Check for `any` usage (should be avoided).
   - Verify that external inputs are validated (Zod schemas).
   - Ensure `unknown` is used for uncertain input shapes.
   - Verify error handling: informative errors, no swallowing, "fail fast" in CLI.

4. **Architectural Analysis**
   - Ensure source-specific logic is isolated in `src/adapters/`.
   - Check for magic numbers/strings that should be constants.
   - Evaluate code readability and DRY principle.

5. **Generate Review Artifact**
   - Create or update `openspec/changes/<change-name>/review.md`.
   - Format the report with clear severity levels:
     - 🔴 **CRITICAL**: Security flaws, `npm audit` failures, major style violations.
     - 🟡 **WARNING**: Architecture improvements, missing constants, weak typing.
     - 🟢 **SUGGESTION**: Naming, documentation, non-blocking refactoring.

## Integration with Apply
After generating the report, inform the user:
"Review report created at `openspec/changes/<change-name>/review.md`. You can now run `/opsx:apply` and ask me to 'implement fixes from the review report' to automate the improvements."
