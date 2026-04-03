# TDP Portal Equivalents

The Teams Developer Portal (TDP) is the web UI at [dev.teams.microsoft.com](https://dev.teams.microsoft.com) for managing Teams apps. teams2 provides CLI equivalents for most portal operations — and some that go beyond what the portal offers.

## Command-to-Portal Mapping

| CLI Command | Portal Equivalent |
|-------------|-------------------|
| `teams2 app list` | Apps → app list |
| `teams2 app create` | Apps → New app *(CLI also handles AAD + bot registration in one step)* |
| `teams2 app view` | Apps → select app → overview |
| `teams2 app edit` | Apps → select app → Basic information |
| `teams2 app manifest download` | Apps → select app → App package → Download |
| `teams2 app manifest upload` | Apps → select app → App package → Upload (manifest only) |
| `teams2 app package download` | Apps → select app → App package → Download (full zip) |
| `teams2 app doctor` | *No portal equivalent* |
| `teams2 app bot status` | Apps → select app → App features → Bot (location shown) |
| `teams2 app bot migrate` | *No portal equivalent* |
| `teams2 app auth secret create` | Azure Portal → App registrations → Certificates & secrets |
| `teams2 app auth oauth add` | Azure Portal → Bot Service → Configuration → OAuth |
| `teams2 app auth oauth list` | Azure Portal → Bot Service → Configuration → OAuth |
| `teams2 app auth oauth remove` | Azure Portal → Bot Service → Configuration → OAuth |
| `teams2 app auth sso setup` | *No single equivalent — requires Azure Portal + TDP manifest edits* |
| `teams2 app auth sso list` | Azure Portal → Bot Service → Configuration (filtered) |
| `teams2 app auth sso edit` | Azure Portal → Bot Service → Configuration → edit connection |
| `teams2 app auth sso remove` | Azure Portal → Bot Service + TDP manifest |
| `teams2 scaffold manifest` | *No portal equivalent* |
| `teams2 config` | *No portal equivalent* |

## Key Differences

### App Creation

In the portal, creating a Teams app and registering a bot are separate steps. In teams2, `app create` does everything in a single command:

1. Creates an AAD app (via TDP API)
2. Generates a client secret (via Graph API)
3. Generates and imports the manifest (via TDP API)
4. Registers the bot (via TDP or Azure)

### SSO Setup

SSO setup in the portal requires jumping between three different UIs:
- Azure Portal → App registrations (identifier URI, scopes, pre-auth clients)
- Azure Portal → Bot Service (OAuth connection)
- TDP → App manifest (webApplicationInfo)

`teams2 app auth sso setup` does all three in one command.

### App Doctor

`teams2 app doctor` has no portal equivalent. It cross-references data from TDP, Graph, and Azure to verify your app is correctly configured — checking bot registration, AAD app health, manifest consistency, and SSO configuration.

### Bot Migration

The portal doesn't support migrating a bot from the BF tenant to Azure. `teams2 app bot migrate` handles the full lifecycle: validation, BF deletion, Azure creation, and automatic rollback on failure.
