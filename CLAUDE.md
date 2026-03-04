# Conventions

## Git

Do not commit or push unless explicitly asked.

## Colors

Use picocolors for terminal styling.

- Success/username: `pc.bold(pc.green(...))`
- Warning: `pc.yellow(...)`
- Command hints: `pc.cyan(...)`
- Labels: `pc.dim(...)`
- Errors: `pc.red(...)`

## Dates

Use `Intl.DateTimeFormat` via `formatDate()` from `src/utils/date.ts`.

## Logging

Use `logger` from `src/utils/logger.ts`. `--verbose` enables `logger.debug()`.

## Spinners

Use `nanospinner` for async operations. Always include descriptive text.

## TypeScript

Avoid `as unknown as X` double-casts and `any` types unless absolutely necessary. Prefer fixing the underlying type (adding a field to an interface, using a proper generic, etc.) over casting.

## CLI Options

Prefix truly optional flags with `[OPTIONAL]` in their description:

```typescript
.option("--env <path>", "[OPTIONAL] Path to .env file")
```

Do NOT mark as `[OPTIONAL]` if the value will be prompted interactively when not provided. Those are required inputs, just with an alternative input method.

## Code Reuse

Before implementing logic, check if a shared function already exists for it. Extract reusable logic into shared modules (e.g., `src/utils/`, action files like `manifest/actions.ts`, `secret/generate.ts`). Never duplicate business logic across interactive menus and CLI subcommands — both should call the same shared function.
