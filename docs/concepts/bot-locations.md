# Bot Locations: BF Tenant vs Azure

When you create a bot for a Teams app, the bot registration can live in one of two places. Understanding the difference is key to choosing the right approach.

## BF Tenant (Bot Framework)

The **BF tenant** is a Microsoft-managed environment where bot registrations live by default. When you create a bot via the Teams Developer Portal (TDP) or via `teams app create` (without `--azure`), the registration goes here.

**Pros:**
- No Azure subscription needed
- Zero infrastructure to manage
- Fastest path to a working bot
- Good for prototyping and development

**Cons:**
- No OAuth connection management (can't add OAuth providers)
- No SSO configuration
- Limited control over the registration

## Azure Bot

An **Azure bot** is a bot registration in your own Azure subscription (via Azure Bot Service). You get full control over the registration and access to features that require Azure.

**Pros:**
- Full OAuth connection support (`teams app auth oauth`)
- SSO configuration (`teams app auth sso setup`)
- Managed via Azure Portal or `az` CLI
- Enterprise-grade control and auditing

**Cons:**
- Requires an Azure subscription
- Requires Azure CLI (`az`) to be installed and logged in
- Requires a resource group

## How the CLI Detects Location

teams determines a bot's location by calling `GET /botframework/{botId}` on the TDP API:

- **200 response** → bot is in the BF tenant
- **404 response** → bot is in Azure

This is the same check used by `teams app bot status`.

## Choosing a Location

| Scenario | Recommended |
|----------|------------|
| Quick prototyping | BF tenant |
| Development/testing | BF tenant |
| Need OAuth connections | Azure |
| Need SSO | Azure |
| Production deployment | Azure |
| No Azure subscription | BF tenant |

## Default Location

By default, `teams app create` uses the BF tenant. Override this per-command:

```bash
teams app create --name "My Bot" --azure --resource-group my-rg
teams app create --name "My Bot" --bf
```

Or set a persistent default:

```bash
teams config default-bot-location azure
```

**Precedence:** explicit flag (`--azure`/`--bf`) > saved config > BF default.

## Migration

You can migrate a bot from the BF tenant to Azure without changing your AAD app or credentials:

```bash
teams app bot migrate <appId> --resource-group my-rg
```

See [app bot migrate](/commands/app/bot-migrate) for details. The migration:

1. Validates the bot is currently in BF
2. Deletes the BF registration
3. Creates an Azure Bot resource
4. Automatically rolls back if step 3 fails

Your `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` remain unchanged. However, some features need manual reconfiguration after migration:

- **M365 Extensions channel** — must be re-enabled in Azure Portal
- **Calling endpoint** — must be reconfigured if previously set
