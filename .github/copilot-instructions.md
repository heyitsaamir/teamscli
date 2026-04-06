# Copilot Instructions

This is a TypeScript CLI tool (`teams`) for managing Microsoft Teams apps. It uses Commander.js for command parsing, MSAL for auth, and talks to TDP (Teams Developer Portal) APIs.

## Code Style

### TypeScript

- Avoid `as unknown as X` double-casts and `any` types. Prefer fixing the underlying type (adding a field to an interface, using a proper generic, etc.) over casting.
- Use `Intl.DateTimeFormat` via `formatDate()` from `src/utils/date.ts` for dates — no `moment` or `date-fns`.
- Use `logger` from `src/utils/logger.ts` for logging. `--verbose` enables `logger.debug()`.
- Use `picocolors` (`pc`) for terminal styling:
  - Success/username: `pc.bold(pc.green(...))`
  - Warning: `pc.yellow(...)`
  - Command hints: `pc.cyan(...)`
  - Labels: `pc.dim(...)`
  - Errors: `pc.red(...)`
- Use `nanospinner` for async operations. Always include descriptive text.

### CLI Options

- Prefix truly optional flags with `[OPTIONAL]` in their description.
- Do NOT mark as `[OPTIONAL]` if the value will be prompted interactively when not provided.

### Commander Patterns

- Use Commander's built-in features for global flags and hooks.
- Don't manually parse `process.argv` — use `.option()` on the program and access via `optsWithGlobals()` in `preAction` hooks.

### Code Reuse

- Check if a shared function already exists before implementing logic.
- Extract reusable logic into shared modules (`src/utils/`, action files like `manifest/actions.ts`, `secret/generate.ts`).
- Never duplicate business logic across interactive menus and CLI subcommands — both should call the same shared function.

## Architecture

### AAD App Creation — Use TDP, Not Graph API

Create AAD apps via TDP's `/aadapp/v2` endpoint (`createAadAppViaTdp` in `src/apps/tdp.ts`), NOT via Graph API directly. TDP's backend creates the service principal server-side, which is required for single-tenant bot registration.

- `signInAudience`: Always `AzureADMultipleOrgs` (multi-tenant AAD app)
- `isSingleTenant`: Always `true` on bot registration (SFI requirement)
- TDP returns a different `id` than Graph's object ID — use `getAadAppByClientId` to look up the Graph object ID before calling `addPassword`
- Graph replication lag may require retries after TDP creates the app

### Auth Client ID

Uses ATK's shared public client `7ea7c24c-b1f6-4a20-9d11-9ae12e9e7ac0`. TDP's own web UI uses a different first-party client ID (`e1979c22`) which we cannot use for CLI auth.

### Credential Output

Always output `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` together. The `TENANT_ID` comes from `account.tenantId` (MSAL AccountInfo).

### Bot Location

- Detection uses `getBotLocation(token, botId)` in `src/apps/bot-location.ts` — calls `/botframework/{botId}`, 200 = "bf", 404 = "azure".
- Default location is BF tenant, overridable via `--azure`/`--bf` flags or `teams config set default-bot-location`.
- SSO URI must be `api://botid-{botId}` — Teams regex requires `botid-` prefix.
