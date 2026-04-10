---
name: teams-bot-infra
description: Manage Microsoft Teams bot infrastructure using the Teams CLI. Use when the user wants to create, configure, or troubleshoot Teams bot apps and registrations. Does not cover building or hosting bot application code.
---

# Teams Bot Infrastructure Management

This skill guides you through creating, configuring, and troubleshooting Microsoft Teams bot infrastructure using the Teams CLI. It does NOT cover building or hosting bot application code.

## 1. Prerequisites Verification

Before creating a Teams bot, verify these prerequisites:

### Step 1: Check Teams CLI Installation

Verify the Teams CLI is installed:

```bash
teams --version
```

**Expected output:** Shows version number (e.g., `1.0.0` or similar)

**If not installed:**

Install the Teams CLI using npm:

```bash
npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
```

**After installation:**
- Verify: Run `teams --version` to confirm installation
- You should see the version number

**Checkpoint:** Teams CLI is installed.

### Step 2: Check Authentication

Run the following command to check authentication status:

```bash
teams status
```

**Expected output:** Shows authenticated user information.

**If not authenticated:**
1. Run: `teams login`
2. Follow the authentication flow
3. Verify: Run `teams status` again and confirm you see your authenticated account

**Checkpoint:** Authentication verified before proceeding.

### Step 3: Verify Bot Endpoint Availability

Ask the user: **"Do you have a bot messaging endpoint URL?"**

**If YES:**
- Confirm the endpoint format: `https://your-domain/api/messages`
- Common formats:
  - Devtunnels: `https://your-tunnel.devtunnels.ms/api/messages`
  - ngrok: `https://your-ngrok-id.ngrok.io/api/messages`
  - Azure: `https://your-app.azurewebsites.net/api/messages`
- Default port for Teams SDK samples: `3978`

**If NO:**
- Recommend **Microsoft devtunnels** (recommended, Microsoft product)
- Link: https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started?tabs=windows
- Alternative: ngrok
- **Out of scope:** Setting up the tunnel itself (point user to docs)
- User should set up tunnel first, then return to this workflow

**Checkpoint:** Bot endpoint URL is ready.

---

## 2. Create Teams Bot

Now create the Teams bot with infrastructure.

### Step 1: Run Creation Command

Execute the following command (replace placeholders):

```bash
teams app create --name "YourBotName" --endpoint "https://your-endpoint/api/messages" --json
```

**Parameters:**
- `--name`: Your bot's display name (e.g., "Notification Bot", "MyBot")
- `--endpoint`: The bot messaging endpoint URL from Step 2
- `--json`: Output structured JSON (required for parsing)

**Expected:** Command completes successfully and returns JSON output.

### Step 2: Parse JSON Output

The command returns JSON with these fields:

```json
{
  "appName": "YourBotName",
  "teamsAppId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "botId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "endpoint": "https://your-endpoint/api/messages",
  "installLink": "https://teams.microsoft.com/l/app/...",
  "botLocation": "bf",
  "credentials": {
    "CLIENT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "CLIENT_SECRET": "your-secret-value",
    "TENANT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

### Step 3: Display Credentials

Extract and display the credentials clearly:

```
CLIENT_ID=<value-from-json>
CLIENT_SECRET=<value-from-json>
TENANT_ID=<value-from-json>
```

**Instruct the user:**

"Add these credentials to your .env file. Your bot application code will need these values to authenticate with Microsoft Teams."

**Do NOT automatically write to .env file** - let the developer decide where to store credentials.

### Step 4: Display Install Link

Show the install link from the JSON output:

```
Install your bot in Teams:
<install-link-from-json>
```

**Instruct the user:**

"Open this link in your browser to install the bot in Microsoft Teams. You can install it for personal use, in a team, or in a group chat."

**Do NOT automatically open the browser** - let the user decide when to install.

**Checkpoint:** Bot created successfully, credentials and install link displayed.

---

## 3. Verification

Verify the bot was created successfully.

### Step 1: Verify App Exists

Run the following command (use the `teamsAppId` from creation output):

```bash
teams app view <teamsAppId> --json
```

**Expected output:** Returns app details matching what was created:
- `teamsAppId` matches
- `botId` matches
- `endpoint` matches
- App shows as active

**If verification fails:** Check the error message and refer to Error Recovery section.

**Checkpoint:** App verified in Teams Developer Portal.

---

## 4. Common Operations

### Update Teams CLI

**Use case:** Update the Teams CLI to the latest version (recommended to stay current with new features and bug fixes)

**Command:**

```bash
teams self-update
```

**When to use:**
- Periodically update to get latest features
- After bug reports or known issues
- When new CLI features are announced

**Expected:** CLI downloads and installs the latest version

### Update Bot Endpoint

**Use case:** Endpoint URL changed (new ngrok/devtunnels session, redeployment, local → cloud migration)

**Command:**

```bash
teams app edit <appId> --endpoint "https://new-endpoint-url/api/messages"
```

**When to use:**
- Ngrok URL changed (new session)
- Devtunnels URL changed
- Deployed bot to cloud (Azure, AWS, etc.)
- Switched from local dev to production endpoint

### View App Details

**Command:**

```bash
teams app view <appId> --json
```

**Use case:** Check current bot configuration, verify settings

### List All Apps

**Command:**

```bash
teams app list
```

**Use case:** See all Teams apps you've created

---

## 5. Error Recovery

### Cannot Install App (Sideloading Disabled)

**Symptom:** Install link shows "Permission denied", "Custom apps are blocked", or similar message

**Cause:** Tenant administrator has disabled custom app upload (sideloading)

**Solution:**

1. Contact your tenant administrator
2. Request they enable custom app upload
3. Reference documentation: https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/prepare-your-o365-tenant#enable-custom-teams-apps-and-configure-custom-app-upload-settings

**Admin steps:** Admin must enable "Allow interaction with custom apps" in Teams admin center.

### AUTH_REQUIRED Error

**Symptom:** Command fails with "Not logged in", "AUTH_REQUIRED", or "authentication required" message

**Cause:** Not authenticated or authentication token expired

**Solution:**

1. Run: `teams login`
2. Complete authentication flow
3. Verify: Run `teams status` and confirm authenticated
4. Retry the original command

### AUTH_TOKEN_FAILED Error

**Symptom:** Command fails with "Failed to get token" or "AUTH_TOKEN_FAILED" message

**Cause:** Token acquisition failed (expired, corrupted, or network issue)

**Solution:**

1. Run: `teams login` again to refresh tokens
2. Verify: Run `teams status` shows authenticated
3. Retry the original command

---

## 6. Resources

### Building Bot Application Code

This skill covers bot infrastructure only. To build the actual bot code:

**Teams AI SDK (Recommended):**
- https://microsoft.github.io/teams-sdk/welcome
- Comprehensive bot framework with built-in Teams features
- Supports TypeScript, JavaScript, Python, C#

### Setting Up Development Tunnels

**Microsoft devtunnels (Recommended):**
- https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started?tabs=windows
- Microsoft's official tunneling solution
- Free for development use

**ngrok (Alternative):**
- https://ngrok.com
- Popular tunneling service
- Free tier available

### Teams App Development Documentation

**General Teams app development:**
- https://learn.microsoft.com/en-us/microsoftteams/platform/

**Bot-specific documentation:**
- https://learn.microsoft.com/en-us/microsoftteams/platform/bots/what-are-bots

---

## Workflow Summary

```
1. Prerequisites
   ├─ Install CLI: npm install -g <url>
   ├─ Authenticate: teams login
   └─ Prepare endpoint: https://your-domain/api/messages

2. Create Bot
   └─ teams app create --name X --endpoint Y --json

3. Handle Output
   ├─ Display credentials (CLIENT_ID, CLIENT_SECRET, TENANT_ID)
   ├─ Instruct: Add to .env file
   └─ Display install link

4. Verify
   └─ teams app view <teamsAppId> --json

5. Common Operations
   └─ Update endpoint: teams app edit <appId> --endpoint <new-url>

6. Troubleshoot
   ├─ Sideload disabled → Admin enables custom app upload
   └─ AUTH_REQUIRED → teams login, retry
```

---

## Out of Scope

This skill does NOT cover:
- ❌ Building bot application code (see Teams AI SDK)
- ❌ Hosting or deploying bot code (Azure, AWS, etc.)
- ❌ Setting up devtunnels/ngrok (link provided to docs)
- ❌ Bot development patterns and best practices
- ❌ Teams app manifest customization (uses CLI defaults)

For bot code development, start with: https://microsoft.github.io/teams-sdk/welcome
