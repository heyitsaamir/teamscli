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

## Build

Always run `npm run build` after changes — the CLI runs from `dist/`, not source. `tsc --noEmit` only type-checks.

## Commander Patterns

Use Commander's built-in features for global flags and hooks. Don't manually parse `process.argv` — use `.option()` on the program and access via `optsWithGlobals()` in `preAction` hooks.

## Pre-PR Validation

Before creating a PR, always run the agentic tests defined in `agentic-tests.md`. These are basic smoke tests (setup/act/assert) that verify the CLI works end-to-end. Run `pnpm build` first, then execute each test scenario via `node dist/index.js <command>` (not the global `teams` command) and confirm expected output.

# Architecture Decisions

## AAD App Creation — Use TDP, Not Graph API

Create AAD apps via TDP's `/aadapp/v2` endpoint (`createAadAppViaTdp` in `src/apps/tdp.ts`), NOT via Graph API directly. TDP's backend creates the service principal server-side, which is required for single-tenant bot registration.

- `signInAudience`: Always `AzureADMultipleOrgs` (multi-tenant AAD app)
- `isSingleTenant`: Always `true` on bot registration (SFI requirement)
- TDP returns a different `id` than Graph's object ID — use `getAadAppByClientId` to look up the Graph object ID before calling `addPassword`
- Graph replication lag may require retries after TDP creates the app

## Auth Client ID

Uses ATK's shared public client `7ea7c24c-b1f6-4a20-9d11-9ae12e9e7ac0`. TDP's own web UI uses a different first-party client ID (`e1979c22`) which we cannot use for CLI auth.

## Credential Output

Always output `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` together. The `TENANT_ID` comes from `account.tenantId` (MSAL AccountInfo).
