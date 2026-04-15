# Integrating Teams into an Existing Server

This guide helps you add Microsoft Teams bot functionality to an existing HTTP server (Express, Flask, FastAPI, etc.) using the Teams SDK's `HttpServerAdapter`.

## Overview

The Teams SDK allows you to integrate Teams bot capabilities into your existing server without changing your server architecture. You manage your server lifecycle independently while the SDK handles Teams-specific functionality.

**Official Documentation:**
- TypeScript: https://microsoft.github.io/teams-sdk/typescript/in-depth-guides/server/http-server
- Python: https://microsoft.github.io/teams-sdk/python/in-depth-guides/server/http-server

## High-Level Flow

### 1. Install Teams SDK

**TypeScript:**
```bash
npm install @microsoft/teams.apps
```

**Python:**
```bash
pip install teams-ai
```

### 2. Create the Adapter

**TypeScript (Express):**
```typescript
import express from 'express';
import { App, ExpressAdapter } from '@microsoft/teams.apps';

const app = express();
app.use(express.json());

// Your existing routes here...
app.post('/your-endpoint', ...);

// Create adapter - pass Express app instance, NOT http.Server
const adapter = new ExpressAdapter(app);
const teamsApp = new App({ httpServerAdapter: adapter });
```

**Python (Flask):**
```python
from flask import Flask
from teams import App, FlaskAdapter

app = Flask(__name__)

# Your existing routes here...
@app.route('/your-endpoint')
def your_endpoint():
    ...

# Create adapter
adapter = FlaskAdapter(app)
teams_app = App(http_server_adapter=adapter)
```

### 3. Add Bot Message Handler

**TypeScript:**
```typescript
teamsApp.on('message', async ({ send, activity }) => {
  const userMessage = activity.text || '';
  // Your bot logic here...
  await send('Response message');
});
```

**Python:**
```python
@teams_app.on_message()
async def on_message(context):
    user_message = context.activity.text
    # Your bot logic here...
    await context.send('Response message')
```

### 4. Initialize Teams App

**Important**: Call `initialize()`, NOT `start()` - you manage the server yourself.

**TypeScript:**
```typescript
await teamsApp.initialize();

// Start your server as usual
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Python:**
```python
teams_app.initialize()

# Start your server as usual
if __name__ == '__main__':
    app.run(port=3000)
```

### 5. Set Up Bot Infrastructure

Follow the **[Bot Infrastructure Setup guide](guide-bot-infra-creation.md)** to:
- Create Teams-managed bot registration
- Get bot credentials (CLIENT_ID, CLIENT_SECRET, TENANT_ID)
- Configure environment variables

### 6. Set Up Development Tunnel

Your local server needs to be accessible from the internet for Teams to reach it.

**Using devtunnels (recommended):**
```bash
# Create tunnel
devtunnel create

# Add port with AUTO protocol (not https)
devtunnel port create --port-number 3000 --protocol auto

# Enable anonymous access
devtunnel access create <tunnel-id> --anonymous

# Start hosting
devtunnel host --port-numbers 3000
```

**Get tunnel URL:** Look for `https://<random-id>-3000.usw2.devtunnels.ms`

See: https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started

### 7. Configure Bot Endpoint

**Via CLI:**
```bash
teams app update <teamsAppId> --endpoint "https://<tunnel-url>/api/messages"
```

**Note:** For Teams-managed bots, if the CLI shows `endpoint: null` after update, configure it manually:
1. Go to https://dev.teams.microsoft.com/apps/<teamsAppId>
2. Navigate to **Configure → Bot**
3. Set **Messaging endpoint** to your tunnel URL + `/api/messages`
4. Save changes

### 8. Test Your Bot

Install the bot in Teams using the install link:
```
https://teams.microsoft.com/l/app/<teamsAppId>?installAppPackage=true
```

## Key Points

✅ **Adapter Parameter**: Pass your server app instance to the adapter, not an http.Server wrapper
✅ **Initialize vs Start**: Call `teamsApp.initialize()`, NOT `teamsApp.start()`
✅ **Tunnel Protocol**: Use `--protocol auto` for devtunnels (not `https`)
✅ **Anonymous Access**: Always add `--anonymous` access to your tunnel
✅ **Endpoint Configuration**: May need Developer Portal for Teams-managed bots

## Common Errors

**ERR_HTTP_HEADERS_SENT**: You likely passed http.Server to the adapter instead of the app instance.

**401 Unauthorized on tunnel**: Add anonymous access with `devtunnel access create <tunnel-id> --anonymous`

**Messages not reaching bot**: Check that the messaging endpoint is configured in Developer Portal.

## Related Guides

- **[Bot Infrastructure Setup](guide-bot-infra-creation.md)** - Create bot registration and credentials
- **[Bot Application Development](guide-create-bot-app.md)** - Scaffold a new Teams bot project
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
