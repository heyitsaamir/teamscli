# Authentication

teams2 uses Microsoft's MSAL (Microsoft Authentication Library) to authenticate with Microsoft 365. This page explains how auth works and what tokens are used.

## Login

```bash
teams2 login
```

This starts a **device code flow** — you'll see a code and a URL. Open the URL in your browser, enter the code, and sign in with your Microsoft 365 account.

Your session is cached locally and persists across CLI invocations. You don't need to log in every time.

## Logout

```bash
teams2 logout
```

Clears your cached session.

## Check Status

```bash
teams2 status
```

Shows your current login state, including your username and tenant. With `-v`, also shows tenant ID and home account ID.

```bash
teams2 status -v
```

## How It Works

### MSAL Token Cache

teams2 uses `@azure/msal-node` with the persistent token cache extension (`@azure/msal-node-extensions`). Tokens are stored securely using your OS keychain (macOS Keychain, Windows Credential Manager, or Linux Secret Service).

### Client ID

The CLI authenticates using a shared public client ID (`7ea7c24c-b1f6-4a20-9d11-9ae12e9e7ac0`) from Microsoft's Agents Toolkit (ATK). This is different from the Teams Developer Portal's own first-party client ID.

### Scopes

teams2 requests tokens for:

- **Teams Developer Portal API** — to create/manage apps, manifests, bot registrations
- **Microsoft Graph** — to manage AAD app registrations (passwords, redirect URIs, etc.)

### Azure CLI Auth

Some operations (Azure bots, OAuth connections, SSO setup) shell out to the `az` CLI. These use your separate Azure CLI login — run `az login` before using these features.

The `teams2 status` command shows both your M365 login state and your Azure CLI connection status.
