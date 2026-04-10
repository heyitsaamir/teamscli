# teams

CLI for managing Microsoft Teams apps.

📖 **[Full documentation → heyitsaamir.github.io/teamscli](https://heyitsaamir.github.io/teamscli/)**

## Install

```bash
npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
```

## Usage

```bash
teams
```

This launches an interactive CLI. You can also run specific commands directly:

```bash
teams login                          # Sign in with your Microsoft account
teams logout                         # Sign out
teams status                         # Check authentication status
teams apps                           # List your Teams apps (alias for app list)
teams app                            # Manage a Teams app (interactive menu)
teams app list                       # List your Teams apps
teams app create                     # Create a new Teams app with bot
teams app view [appId]               # View a Teams app
teams app edit [appId]               # Edit app properties
teams app doctor [appId]             # Run diagnostic checks
teams app manifest download [appId]  # Download manifest
teams app manifest upload [appId]    # Upload manifest
teams app package download [appId]   # Download app package
teams app bot status [appId]         # Show bot location (Teams-managed vs Azure)
teams app bot migrate [appId]        # Migrate bot to Azure
teams app auth secret create [appId] # Generate a client secret
teams app user-auth oauth add [appId]    # Add OAuth connection
teams app user-auth oauth list [appId]   # List OAuth connections
teams app user-auth oauth remove [appId] # Remove OAuth connection
teams app user-auth sso setup [appId]    # Set up SSO
teams app user-auth sso list [appId]     # List SSO connections
teams app user-auth sso edit [appId]     # Edit SSO connection
teams app user-auth sso remove [appId]   # Remove SSO connection
teams scaffold manifest              # Create a manifest.json file
teams config                         # Manage CLI configuration
teams self-update                    # Update to the latest version
```

## Global Options

| Flag | Description |
|------|-------------|
| `-v, --verbose` | Enable verbose logging |
| `--json` | Output results as JSON (machine-readable) |
| `--yes` / `-y` | Skip confirmation prompts (CI/agent use) |
| `--disable-auto-update` | Disable automatic update checks |

## Disclaimer

This project is **not** affiliated with, endorsed by, or sponsored by Microsoft Corporation. "Microsoft Teams" is a trademark of Microsoft Corporation.

## License

MIT
