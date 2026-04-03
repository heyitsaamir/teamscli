# Installation

## Prerequisites

- **Node.js** 18 or later
- **npm** (comes with Node.js)
- **Azure CLI** (`az`) — only needed for Azure bot operations (optional)

## Install

Install `teams2` globally from the GitHub release:

```bash
npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
```

## Verify

```bash
teams2 --version
```

## Update

The CLI checks for updates automatically on each run. To update manually:

```bash
teams2 self-update
```

Disable auto-update checks with:

```bash
teams2 --disable-auto-update <command>
```

## Azure CLI (Optional)

If you plan to create Azure bots or configure OAuth/SSO, install the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli):

```bash
# macOS
brew install azure-cli

# Windows
winget install Microsoft.AzureCLI
```

Then sign in:

```bash
az login
```
