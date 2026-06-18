---
description: Deep verification of implementation against change artifacts plus project style, architecture, and security checks. Saves a review.md report. Use instead of opsx:verify when you want full quality assurance before archiving.
---

Perform a full verification of the implementation: completeness against tasks/specs, correctness against requirements, coherence with design and project style guide, and security checks. Save the report to `openspec/changes/<change-name>/review.md`.

**Input**: Optionally specify a change name after the command. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show changes that have implementation tasks (tasks artifact exists).
   Include the schema used for each change if available.
   Mark changes with incomplete tasks as "(In Progress)".

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - Which artifacts exist for this change

3. **Get the change directory and load artifacts**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   This returns the change directory and `contextFiles` (artifact ID -> array of concrete file paths). Read all available artifacts from `contextFiles`.

   Also read `STYLE-GUIDE.md` now — it is required for Coherence checks.

4. **Initialize verification report structure**

   Create a report structure with four dimensions:
   - **Completeness**: Track tasks and spec coverage
   - **Correctness**: Track requirement implementation and scenario coverage
   - **Coherence**: Track design adherence, project style compliance, and pattern consistency
   - **Security**: Track hardcoded secrets and dependency vulnerabilities

   Each dimension can have CRITICAL, WARNING, or SUGGESTION issues.

5. **Verify Completeness**

   **Task Completion**:
   - If `contextFiles.tasks` exists, read every file path in it
   - Parse checkboxes: `- [ ]` (incomplete) vs `- [x]` (complete)
   - Count complete vs total tasks
   - If incomplete tasks exist:
     - Add CRITICAL issue for each incomplete task
     - Recommendation: "Complete task: <description>" or "Mark as done if already implemented"

   **Spec Coverage**:
   - If delta specs exist in `openspec/changes/<name>/specs/`:
     - Extract all requirements (marked with "### Requirement:")
     - For each requirement:
       - Search codebase for keywords related to the requirement
       - Assess if implementation likely exists
     - If requirements appear unimplemented:
       - Add CRITICAL issue: "Requirement not found: <requirement name>"
       - Recommendation: "Implement requirement X: <description>"

6. **Verify Correctness**

   **Requirement Implementation Mapping**:
   - For each requirement from delta specs:
     - Search codebase for implementation evidence
     - If found, note file paths and line ranges
     - Assess if implementation matches requirement intent
     - If divergence detected:
       - Add WARNING: "Implementation may diverge from spec: <details>"
       - Recommendation: "Review <file>:<lines> against requirement X"

   **Scenario Coverage**:
   - For each scenario in delta specs (marked with "#### Scenario:"):
     - Check if conditions are handled in code
     - Check if tests exist covering the scenario
     - If scenario appears uncovered:
       - Add WARNING: "Scenario not covered: <scenario name>"
       - Recommendation: "Add test or implementation for scenario: <description>"

7. **Verify Coherence**

   **Design Adherence**:
   - If `contextFiles.design` exists:
     - Extract key decisions (look for sections like "Decision:", "Approach:", "Architecture:")
     - Verify implementation follows those decisions
     - If contradiction detected:
       - Add WARNING: "Design decision not followed: <decision>"
       - Recommendation: "Update implementation or revise design.md to match reality"
   - If no design.md: Skip design adherence check, note "No design.md to verify against"

   **TypeScript Style (Ref: STYLE-GUIDE.md)**:
   - `any` usage: allowed only during active refactoring; otherwise → CRITICAL
   - `unknown` not used for uncertain input shapes → WARNING
   - Exported functions without explicit return types → WARNING
   - External inputs (CLI args, env, HTTP payloads) not validated → WARNING
   - TypeScript types duplicated instead of derived from Zod via `z.infer` → WARNING
   - One-letter variable names (except established conventions) → WARNING

   **Imports & Modules (Ref: STYLE-GUIDE.md)**:
   - Relative imports (`./`, `../`) instead of absolute `src/` paths → WARNING
   - Source-specific logic outside `src/adapters/` → WARNING

   **Error Handling (Ref: STYLE-GUIDE.md)**:
   - Swallowed errors (empty catch, silent failures) → WARNING
   - Vague errors without actionable context → SUGGESTION
   - CLI commands that don't fail fast with clear user-facing messages → WARNING

   **Testing (Ref: STYLE-GUIDE.md)**:
   - `throw` used in tests for type narrowing instead of `as` assertions → WARNING

   **Config Sync (Ref: STYLE-GUIDE.md)**:
   - New environment variables added without updating `.env.example` → CRITICAL
   - `config/sources.json` changed without syncing `config/sources.example.json` and related tests → WARNING

   **Linting Gates (Ref: STYLE-GUIDE.md)**:
   - Run: `npm run typecheck && npm run lint && npm run check`
   - Any failure → CRITICAL

   **Code Pattern Consistency**:
   - Check file naming and directory structure for significant deviations
   - If found → SUGGESTION with reference to the expected pattern

8. **Verify Security**

   **Hardcoded Secrets**:
   - Search changed files for patterns: tokens, passwords, API keys, cookies, connection strings
   - Pay extra attention to `src/adapters/` — external integrations
   - If found:
     - Add CRITICAL: "Hardcoded secret detected: <file>:<line>"
     - Recommendation: "Move to environment variable and add to .env.example"

   **Dependency Vulnerabilities**:
   - Run `npm audit`
   - For each high/critical severity vulnerability:
     - Add CRITICAL: "<package> vulnerability: <description>"
     - Recommendation: "Run `npm audit fix` or update <package>"

9. **Save Verification Report**

   Write the full report to `openspec/changes/<change-name>/review.md`.

   **Report structure**:

   ```markdown
   ## Verification Report: <change-name>

   ### Summary
   | Dimension    | Status            |
   |--------------|-------------------|
   | Completeness | X/Y tasks, N reqs |
   | Correctness  | M/N reqs covered  |
   | Coherence    | Followed/Issues   |
   | Security     | Clean/Issues      |

   ### Issues

   #### 🔴 CRITICAL (Must fix before archive)
   - ...

   #### 🟡 WARNING (Should fix)
   - ...

   #### 🟢 SUGGESTION (Nice to fix)
   - ...

   ### Final Assessment
   <one of the three verdicts below>
   ```

   **Final Assessment verdicts**:
   - If CRITICAL issues: "X critical issue(s) found. Fix before archiving."
   - If only warnings: "No critical issues. Y warning(s) to consider. Ready for archive (with noted improvements)."
   - If all clear: "All checks passed. Ready for archive."

   After writing the file, tell the user:
   "Report saved to `openspec/changes/<change-name>/review.md`. You can run `/opsx:apply` and ask me to 'implement fixes from the review report' to automate the improvements."

**Verification Heuristics**

- **Completeness**: Focus on objective checklist items (checkboxes, requirements list)
- **Correctness**: Use keyword search, file path analysis, reasonable inference — don't require perfect certainty
- **Coherence**: Apply rules from STYLE-GUIDE.md; escalate clear violations, don't nitpick judgment calls
- **Security**: Secrets and audit failures are always CRITICAL — no exceptions
- **False Positives**: When uncertain, prefer SUGGESTION over WARNING, WARNING over CRITICAL
- **Actionability**: Every issue must have a specific recommendation with file/line references where applicable

**Graceful Degradation**

- If only tasks.md exists: verify task completion only, skip spec/design checks
- If tasks + specs exist: verify Completeness and Correctness, skip design adherence
- If full artifacts: verify all four dimensions
- **Security and Coherence (style/linting) always run regardless of artifact availability**
- Always note which checks were skipped and why

**Output Format**

Use clear markdown with:
- Table for summary scorecard
- Grouped lists under 🔴/🟡/🟢 headers
- Code references in format: `file.ts:123`
- Specific, actionable recommendations
- No vague suggestions like "consider reviewing"
