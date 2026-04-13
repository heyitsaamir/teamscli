---
name: teams-bot-infra
description: Manage Microsoft Teams bot infrastructure using the Teams CLI. Use when the user wants to create, configure, or troubleshoot Teams bot apps and registrations. Does not cover building or hosting bot application code.
---

# Teams Bot Infrastructure Management

This skill will guide you in creating, configuring, and troubleshooting Microsoft Teams bot infrastructure using the Teams CLI. It does NOT cover building or hosting bot application code.

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

### Step 3: Verify Bot Endpoint Availability (Optional)

Ask the user: **"Do you have a bot messaging endpoint URL, or will this bot only send proactive messages?"**

**If using proactive flows only (no endpoint needed):**
- Proactive flows = bot sends messages to Teams without first receiving a message from users
- Examples: Notifications, scheduled updates, alerts from external systems
- ⚠️ **Warning:** Without an endpoint, your bot **cannot receive messages from Teams users**. It can only send proactive messages programmatically.
- 💡 **Note:** You can always add an endpoint later using `teams app edit <appId> --endpoint <url>` (see Section 4)
- **Skip to Section 2** — no endpoint required for creation

**If the bot needs to receive messages (endpoint required):**
- Confirm the endpoint format: `https://your-domain/api/messages`
- Common formats:
  - Devtunnels: `https://your-tunnel.devtunnels.ms/api/messages`
  - ngrok: `https://your-ngrok-id.ngrok.io/api/messages`
  - Azure: `https://your-app.azurewebsites.net/api/messages`
- Default port for Teams SDK samples: `3978`

**If NO endpoint yet:**
- Recommend **Microsoft devtunnels** (recommended, Microsoft product)
- Link: https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started?tabs=windows
- Alternative: ngrok
- **Out of scope:** Setting up the tunnel itself (point user to docs)
- User should set up tunnel first, then return to this workflow

**Checkpoint:** Either endpoint URL is ready OR confirmed proactive-only use case.

---

## 2. Create Teams Bot

Now create the Teams bot with infrastructure.

### Step 1: Run Creation Command

Execute the following command (replace placeholders):

**With endpoint (bot receives messages):**
```bash
teams app create --name "YourBotName" --endpoint "https://your-endpoint/api/messages" --json
```

**Without endpoint (proactive flows only):**
```bash
teams app create --name "YourBotName" --json
```

**Parameters:**
- `--name`: Your bot's display name (e.g., "Notification Bot", "MyBot")
- `--endpoint`: **[OPTIONAL]** The bot messaging endpoint URL. Omit this for proactive-only bots.
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
  "botLocation": "teams-managed",
  "credentials": {
    "CLIENT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "CLIENT_SECRET": "your-secret-value",
    "TENANT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

**Note:** If no endpoint was provided, `endpoint` will be `null`. This is normal for proactive-only bots.

### Step 3: Save Credentials to .env File

Ask the user: **"Do you already have a .env file for this project?"**

**If YES:**
- Prompt: "What is the path to your .env file?"
- Default suggestion: `.env` (current directory)
- Example paths: `.env`, `./bot/.env`, `../config/.env`

**If NO:**
- Prompt: "Where should I create the .env file?"
- Default: `.env` (current directory)
- Inform: "I'll create a new .env file at this location"

**After getting the path:**

Write the credentials to the .env file using the values from JSON output:

```
CLIENT_ID=<value-from-json>
CLIENT_SECRET=<value-from-json>
TENANT_ID=<value-from-json>
```

**Instruct the user:**

"Credentials saved to [path]. Your bot application code will use these values to authenticate with Microsoft Teams."

**Important:** If the .env file already exists, update/append the credentials without overwriting other values.

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
- `endpoint` matches (or is empty if not configured)
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

### "This app cannot be found" Error

**Symptom:** Install link shows "This app cannot be found", "App not found", or "We couldn't find this app" when trying to install

**Cause:** The app was created in a different Microsoft 365 tenant than where you're trying to install it

**Common scenario:** App was created in the Microsoft 365 Developer Program tenant (https://developer.microsoft.com/en-us/microsoft-365/dev-program) but you're trying to install it in your work/organization tenant

**Solution:**

1. Open Teams in the same tenant where you created the app
2. If using M365 Developer Program, sign into Teams with your developer account
3. Use the install link - it will now work

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
   └─ [OPTIONAL] Prepare endpoint: https://your-domain/api/messages
      (Skip endpoint for proactive-only bots)

2. Create Bot
   ├─ With endpoint: teams app create --name X --endpoint Y --json
   └─ Without endpoint (proactive-only): teams app create --name X --json

3. Handle Output
   ├─ Ask: "Do you have a .env file?" → Get/create path
   ├─ Write credentials to .env (CLIENT_ID, CLIENT_SECRET, TENANT_ID)
   └─ Display install link

4. Verify
   └─ teams app view <teamsAppId> --json

5. Common Operations
   └─ Add/update endpoint: teams app edit <appId> --endpoint <new-url>

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
