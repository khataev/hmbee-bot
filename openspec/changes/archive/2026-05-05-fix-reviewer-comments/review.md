# Code Review: bootstrap-cli-source-sync
Date: 2026-05-05

## Summary
Review focused on the initial implementation of the Tochka adapter and CLI structure.

## 1. Security & Audit
- 🟢 **npm audit**: 0 vulnerabilities found.
- 🔴 **CRITICAL**: **Sensitive Data Exposure Risk**. In `src/adapters/tochka.ts`, the `cookie` (which contains session data) is passed directly to the `fetch` call and potentially exists in memory as a single string. 
- 🔴 **CRITICAL**: **CSRF Extraction Logic**. The manual regex extraction of CSRF token from a cookie string `cookie.match(/X-CSRF-TOKEN=([^;]+)/)` is fragile and might fail if the cookie format changes slightly, leading to synchronization failure.

## 2. Style Compliance (Ref: STYLEGUIDE.md)
- 🟡 **WARNING**: **Weak Typings (Zod)**. `TochkaTimelineResponseSchema` uses `z.array(z.unknown())`. This violates the "Preserve strong typing" principle in `STYLEGUIDE.md`. Since we have `example-data/tochka/timeline.response.json`, we should define a strict schema for transactions (amount, counterparty, purpose, etc.).
- 🟡 **WARNING**: **Error Handling**. `throw new Error('TOCHKA_COOKIE is required')` is generic. According to `STYLEGUIDE.md` ("In CLI commands, fail fast with clear user-facing messages"), we should provide more context on *how* to set this (e.g., "Add TOCHKA_COOKIE to your .env file").
- 🟢 **any usage**: None found. Proper use of `unknown` for raw data parsing.

## 3. Architectural Analysis
- 🟡 **WARNING**: **Magic Numbers & Strings**. 
    - `page_count: 50` is hardcoded in the request params.
    - `user-agent` and `referer` are hardcoded in headers. These should be moved to a configuration file or constants at the top of the file.
- 🟡 **WARNING**: **Math.random() for RPC ID**. Using `Math.random().toString(36).substring(7)` for an RPC ID is acceptable for a CLI, but `crypto.randomUUID()` (available in Node.js) would be more robust and modern.

## 4. Suggestions
- **Suggestion**: Create a `TochkaError` class extending `Error` to handle API-specific failures (e.g., 401 Unauthorized vs 500 Server Error).
- **Suggestion**: Implement a helper function to format dates instead of inline ternary operators `options.from.includes('T') ? ...`.

---
Review report created. You can now run `/opsx:apply` and ask me to 'implement fixes from the review report' to automate the improvements.
