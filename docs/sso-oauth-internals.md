# SSO & OAuth Internals

This document captures the implementation details of the SSO and OAuth features that were previously available as `teams app user-auth sso` and `teams app user-auth oauth` commands. It is intended as a reference for authoring equivalent workflows in skills or external tooling.

> **Note:** These commands have been removed from the CLI. The underlying operations are all performed via `az` CLI and Microsoft Graph API, so they can be replicated in any environment that has `az` installed and authenticated.

---

## Prerequisites

Both SSO and OAuth required the bot to be **Azure-managed** (not Teams-managed). The CLI enforced this via a shared `requireAzureBot` helper (described below).

### requireAzureBot

This helper was the shared preamble for all user-auth commands. It:

1. Verifies the user is logged in (`teams login`)
2. Resolves the Teams app (from argument or interactive picker)
3. Fetches bot details from TDP and determines bot location via `getBotLocation`
4. If the bot is **Teams-managed (`tm`)**: offers to migrate it to Azure using `teams app bot migrate`
5. Verifies `az` CLI is installed and authenticated (`ensureAz`)
6. Discovers the Azure bot's subscription, resource group, and tenant ID via `discoverAzureBot`

The resulting context (`botId`, `azure.subscription`, `azure.resourceGroup`, `azure.tenantId`) is used by all subsequent `az bot authsetting` calls.

---

## Relationship: SSO is a constrained superset of OAuth

SSO is built on top of the same Azure Bot Service OAuth connection infrastructure as generic OAuth — both ultimately call `az bot authsetting create` and both produce a connection that appears in `az bot authsetting list`. The difference is in what SSO **additionally requires**:

| | Generic OAuth | SSO |
|---|---|---|
| `az bot authsetting create` | any provider | `Aadv2` only |
| `tokenExchangeUrl` parameter | not set | required (`api://botid-{botId}`) |
| AAD app identifier URI | not required | required (`api://botid-{botId}`) |
| `access_as_user` scope | not required | required |
| Teams clients pre-authorized | not required | required |
| `requestedAccessTokenVersion` | not required | must be `2` |
| Bot Framework redirect URI | required | required |
| Manifest `webApplicationInfo` | not required | required |

---

## SSO

### sso setup

The most complex operation. Performs three sequential steps:

#### Step 1: AAD App Configuration (Microsoft Graph)

Two separate PATCH requests to `PATCH /v1.0/applications/{objectId}` — the scope must be created **before** pre-authorized apps reference it.

**PATCH 1 — identifier URI, scope, redirect URI, token version:**
```json
{
  "identifierUris": ["api://botid-{botId}"],
  "api": {
    "requestedAccessTokenVersion": 2,
    "oauth2PermissionScopes": [
      {
        "id": "<uuid>",
        "adminConsentDescription": "Access as user",
        "adminConsentDisplayName": "Access as user",
        "isEnabled": true,
        "type": "User",
        "value": "access_as_user"
      }
    ]
  },
  "web": {
    "redirectUris": ["https://token.botframework.com/.auth/web/redirect"]
  }
}
```

> **Key detail:** `requestedAccessTokenVersion: 2` must be set. Teams issues v2 tokens (AAD v2 endpoint); if the app is still configured for v1, the token exchange will fail because the formats don't match.
```

**PATCH 2 — pre-authorized apps** (after scope exists):
```json
{
  "api": {
    "oauth2PermissionScopes": [ /* same as above */ ],
    "preAuthorizedApplications": [
      {
        "appId": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
        "delegatedPermissionIds": ["<scope-uuid>"]
      },
      {
        "appId": "5e3ce6c0-2b1f-4285-8d4b-75ee78787346",
        "delegatedPermissionIds": ["<scope-uuid>"]
      }
    ]
  }
}
```

The two pre-authorized app IDs are:
- `1fec8e78-bce4-4aaf-ab1b-5451cc387264` — Teams desktop/mobile client
- `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` — Teams web client

> **Key detail:** The `identifierUri` must be `api://botid-{botId}` — the `botid-` prefix is required. Teams validates this with a regex; using `api://{botId}` without the prefix will silently fail SSO.

> **Key detail:** The Graph object ID (`aadApp.id`) differs from the bot's client ID (`botId`). The CLI looked up the object ID via `GET /v1.0/applications?$filter=appId eq '{botId}'` before PATCHing.

#### Step 2: Azure Bot OAuth Connection

```bash
az bot authsetting create \
  --name {botId} \
  --resource-group {resourceGroup} \
  --setting-name {connectionName} \     # default: "sso"
  --service Aadv2 \
  --client-id {botId} \
  --client-secret {clientSecret} \
  --provider-scope-string {scopes} \   # default: "User.Read"
  --parameters \
    tenantId={tenantId} \
    tokenExchangeUrl=api://botid-{botId} \
  --subscription {subscription}
```

> **Key detail:** `tokenExchangeUrl` must exactly match the `identifierUri` from Step 1.

> **Key detail:** A client secret is required. The CLI either accepted one via `--client-secret`, prompted for one, or auto-created one via `POST /v1.0/applications/{objectId}/addPassword`.

#### Step 3: TDP Manifest Update

Called `PATCH /api/v1.0/apps/{appId}` (TDP internal API) with:
```json
{
  "webApplicationInfoId": "{botId}",
  "webApplicationInfoResource": "api://botid-{botId}",
  "validDomains": ["*.botframework.com"]
}
```

This step was non-fatal — if it failed, SSO was still partially configured and the manifest could be updated manually via Developer Portal.

### sso list

```bash
az bot authsetting list \
  --name {botId} \
  --resource-group {resourceGroup} \
  --subscription {subscription}
```

Then filtered to AAD connections by checking `properties.serviceProviderDisplayName` contains `"Azure Active Directory"`. Each candidate was fetched individually with `az bot authsetting show` to check for the presence of a `tokenExchangeUrl` parameter — only connections with that parameter were considered SSO connections.

### sso edit

Azure CLI has no `az bot authsetting update` command. The CLI worked around this by:
1. Fetching the existing connection with `az bot authsetting show`
2. `az bot authsetting delete` the old connection
3. `az bot authsetting create` with the new settings (new scopes or new name)

A new client secret was required for the recreate step (auto-generated if not provided).

### sso remove

```bash
az bot authsetting delete \
  --name {botId} \
  --resource-group {resourceGroup} \
  --setting-name {connectionName} \
  --subscription {subscription}
```

Note: removal did **not** clean up the AAD app registration (identifier URI, scopes, pre-authorized apps) or the manifest `webApplicationInfo` field — those required manual cleanup.

---

## OAuth

### oauth add

Supports any provider supported by Azure Bot Service (Aadv2, GitHub, Google, etc.).

#### Step 1: Create the OAuth connection

```bash
az bot authsetting create \
  --name {botId} \
  --resource-group {resourceGroup} \
  --setting-name {connectionName} \
  --service {provider} \              # e.g. Aadv2, GitHub, Google
  --client-id {clientId} \
  --client-secret {clientSecret} \
  --provider-scope-string {scopes} \
  --parameters {key=value ...} \      # optional extra params
  --subscription {subscription}
```

The list of available providers was fetched via:
```bash
az bot authsetting list-providers
```

#### Step 2: Add Bot Framework redirect URI to Entra app

Via Graph API (same pattern as SSO Step 1):
```
PATCH /v1.0/applications/{objectId}
{
  "web": {
    "redirectUris": ["https://token.botframework.com/.auth/web/redirect"]
  }
}
```

This step was non-fatal — on failure, the CLI printed a manual fallback instruction:
> Add it manually: Entra portal → App registrations → Authentication → Web → Redirect URIs → `https://token.botframework.com/.auth/web/redirect`

#### Step 3: Update TDP manifest validDomains

```json
{ "validDomains": ["*.botframework.com"] }
```

Also non-fatal — manual fallback: Developer Portal → App → Domains → add `*.botframework.com`.

### oauth list

```bash
az bot authsetting list \
  --name {botId} \
  --resource-group {resourceGroup} \
  --subscription {subscription}
```

Returns all connections (not filtered by provider type, unlike SSO list).

### oauth remove

```bash
az bot authsetting delete \
  --name {botId} \
  --resource-group {resourceGroup} \
  --setting-name {connectionName} \
  --subscription {subscription}
```

---

## Token Exchange Flow (SSO)

Once SSO is configured, the silent auth flow works as follows:

```
1. User opens bot in Teams
   ↓
2. Teams client requests SSO token from AAD
   (using pre-authorized client ID and api://botid-{botId} scope)
   ↓
3. Teams sends the token to the bot via an invoke activity
   ↓
4. Bot forwards token to Azure Bot Service
   ↓
5. Bot Service exchanges SSO token for an access token
   (using the OAuth connection's tokenExchangeUrl = api://botid-{botId})
   ↓
6. Bot receives access token with the requested scopes (e.g. User.Read)
```

The user sees no login prompt — the flow is completely silent when the AAD app is correctly configured.

---

## Diagnosing Issues

`teams app doctor` checks SSO configuration health:
- Identifier URI format (`api://botid-{botId}`)
- `access_as_user` scope exists
- Teams clients are pre-authorized
- Bot Framework redirect URI is present
- OAuth connection `tokenExchangeUrl` matches the identifier URI
