# Conventions

## Colors

Use picocolors for terminal styling.

- Success/username: `pc.bold(pc.green(...))`
- Warning: `pc.yellow(...)`
- Command hints: `pc.cyan(...)`
- Labels: `pc.dim(...)`
- Errors: `pc.red(...)`

## Dates

Use `Intl.DateTimeFormat` via `formatDate()` from `src/utils/date.ts`.
