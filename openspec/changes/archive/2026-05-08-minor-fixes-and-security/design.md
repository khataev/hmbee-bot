## Context

Currently, `customerId` for Tochka is hardcoded in `config/sources.json`. This is problematic for security and flexibility. Moreover, the CLI is too verbose for some use cases, outputting progress info regardless of needs.

## Goals / Non-Goals

**Goals:**
- Move Tochka `customerId` to environment variables (`TOCHKA_CUSTOMER_ID`).
- Validate `TOCHKA_CUSTOMER_ID` via Zod in `src/env.ts`.
- Add a `--quiet` flag to the `sync` command.
- Suppress log messages in `src/index.ts` if `--quiet` is set.

**Non-Goals:**
- Changing authentication mechanisms beyond moving a configuration value.
- Adding comprehensive logging levels (only a binary quiet mode).

## Decisions

- **Environment Variable Name**: Use `TOCHKA_CUSTOMER_ID` for consistency with `TOCHKA_COOKIE`.
- **Quiet Mode implementation**: Add `.option('--quiet', 'Suppress informational output')` to the `sync` command in Commander. Use this flag to conditionally skip `console.log` calls in the action handler.
- **Config fallback**: Remove from `sources.json` entirely - it must be in `.env`.

## Risks / Trade-offs

- **[Risk]**: Missing environment variable on deployment.
- **[Mitigation]**: Validate via `validateTochkaEnv` using Zod on startup, throwing clear error messages.

## Engineering Constraints
- Use Zod for validation in `src/env.ts`.
- Ensure all terminal output that isn't the primary command result is suppressed by `--quiet`.
