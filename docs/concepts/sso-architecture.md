# SSO Architecture

Single Sign-On (SSO) lets your Teams bot authenticate users silently using their existing Teams identity. This page explains the architecture and what `teams app auth sso setup` configures.

## Overview

SSO for Teams bots involves three systems working together:

1. **AAD app registration** — configured with the right identifier URI, scopes, and pre-authorized clients
2. **Azure Bot OAuth connection** — bridges the bot to AAD for token exchange
3. **Teams app manifest** — tells Teams where to find the SSO configuration

## What SSO Setup Configures

`teams app auth sso setup` performs three steps in sequence:

### Step 1: AAD App Configuration

Updates the AAD app registration via Microsoft Graph:

- **Identifier URI** → `api://botid-{botId}`
  - The `botid-` prefix is required — Teams validates this with a regex
  - Using `api://{botId}` without the prefix will fail
- **OAuth2 scope** → `access_as_user`
  - A delegated permission scope that allows the bot to act on behalf of the user
- **Pre-authorized clients** → Teams desktop + web clients
  - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop/mobile)
  - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)
- **Redirect URI** → `https://token.botframework.com/.auth/web/redirect`
  - Bot Framework's redirect endpoint for completing the OAuth flow

### Step 2: Azure Bot OAuth Connection

Creates an OAuth connection setting on the Azure Bot using `az bot authsetting create`:

- **Provider** → `Aadv2` (Azure AD v2)
- **Connection name** → `sso` (default, customizable via `--connection-name`)
- **Client ID/secret** → from the AAD app
- **Token exchange URL** → `api://botid-{botId}`
  - Must match the identifier URI exactly
- **Tenant ID** → from the current MSAL session
- **Scopes** → `User.Read` (default, customizable via `--scopes`)

### Step 3: Manifest Update

Updates the Teams app manifest via TDP:

- **`webApplicationInfo.id`** → the bot's client ID
- **`webApplicationInfo.resource`** → `api://botid-{botId}`
- **`validDomains`** → adds `token.botframework.com`

## Token Exchange Flow

Once SSO is configured, the authentication flow works like this:

```
1. User opens bot in Teams
   ↓
2. Teams client requests SSO token from AAD
   (using pre-authorized client ID, identifier URI scope)
   ↓
3. Teams sends token to bot via invoke activity
   ↓
4. Bot sends token to Azure Bot Service
   ↓
5. Bot Service exchanges SSO token for access token
   (using the OAuth connection's tokenExchangeUrl)
   ↓
6. Bot receives access token with requested scopes
```

The user sees no login prompt — it's completely silent.

## Requirements

- Bot must be in **Azure** (not BF tenant) — SSO requires OAuth connection management
- Azure CLI (`az`) must be installed and logged in
- AAD app must exist (created automatically by `teams app create`)

If your bot is in the BF tenant, [migrate it first](/commands/app/bot-migrate):

```bash
teams app bot migrate <appId> --resource-group my-rg
```

## Diagnosing SSO Issues

Use `teams app doctor` to verify your SSO configuration. It checks:

- Identifier URI format (`api://botid-{botId}`)
- `access_as_user` scope exists
- Teams clients are pre-authorized
- Bot Framework redirect URI is present
- OAuth connection `tokenExchangeUrl` matches the identifier URI
