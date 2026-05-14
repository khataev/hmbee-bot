# Team Style Guide v1

This project follows a pragmatic TypeScript style focused on readability and reliability.

## Sources

- Google TypeScript Style Guide (conceptual baseline)
- Effective TypeScript principles
- Biome recommended rules as executable checks

## Core principles

- Prefer explicit and readable code over clever code.
- Keep functions focused and small.
- Preserve strong typing, avoid silent runtime assumptions.
- Optimize for maintainability over micro-optimizations.
- Avoid using one letter names for variables, eg in loops; be descriptive.
- When adding a new environment variable, ALWAYS update `.env.example` to ensure the project remains runnable for others.

## TypeScript rules

- Use `unknown` first when input shape is uncertain.
- Avoid `any`; temporary `any` is allowed only during active refactoring.
- Prefer narrow types and explicit return types for exported functions.
- Validate external input at boundaries (CLI args, env, HTTP payloads).
- If a runtime schema already exists (for example, Zod), derive TypeScript types from that schema (`z.infer`) instead of duplicating shape definitions manually.

## Error handling

- Throw informative errors with actionable context.
- Do not swallow errors silently.
- In CLI commands, fail fast with clear user-facing messages.

## Modules and imports

- Keep source-specific logic inside adapters.
- Keep command orchestration in the CLI entrypoint.
- Prefer named exports unless a default export is clearly simpler.
- Use **absolute imports** starting with `src/` for all project files (e.g., `import { ... } from 'src/env.js'`). **Relative imports (`./`, `../`) are forbidden.**
- Always pin exact version of installed package

## Formatting and linting

- Biome is the single quality tool in this repository.
- Run checks before committing:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run check`

## OpenSpec Definition of Done (DoD)

A change is not complete until:

- OpenSpec tasks are updated and checked.
- `npm run check` passes.
- New behavior and constraints are reflected in OpenSpec specs/tasks where relevant.
