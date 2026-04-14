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
teams app                            # Manage a Teams app (interactive menu)
teams app list                       # List your Teams apps
teams app create                     # Create a new Teams app with bot
teams app get [appId]                # Get a Teams app
teams app update [appId]             # Update app properties
teams app doctor [appId]             # Run diagnostic checks
teams app manifest download [appId]  # Download manifest
teams app manifest upload [appId]    # Upload manifest
teams app package download [appId]   # Download app package
teams app bot get [appId]            # Get bot location (Teams-managed vs Azure)
teams app bot migrate [appId]        # Migrate bot to Azure
teams app auth secret create [appId] # Generate a client secret
teams app rsc list [appId]           # List RSC permissions
teams app rsc add [appId]            # Add RSC permission
teams app rsc remove [appId]         # Remove RSC permission
teams app rsc set [appId]            # Declaratively set RSC permissions
teams project new                    # Create a new Teams app project
teams project config add <name>      # Add Agents Toolkit configuration
teams project config remove <name>   # Remove Agents Toolkit configuration
teams config                         # Manage CLI configuration
teams self-update                    # Update to the latest version
```

> **Note:** For SSO and OAuth setup, see the [User Authentication Setup guide](https://heyitsaamir.github.io/teamscli/guides/user-authentication-setup) or use the **teams-bot-infra** skill.

## Global Options

| Flag | Description |
|------|-------------|
| `-v, --verbose` | Enable verbose logging |
| `--json` | Output results as JSON (machine-readable) |
| `--yes` / `-y` | Skip confirmation prompts (CI/agent use) |
| `--disable-auto-update` | Disable automatic update checks |

## AI Agent Skills

Install agent skills to help AI assistants manage Teams bot infrastructure:

```bash
npx skills add heyitsaamir/teamscli --skill teams-bot-infra
```

See [skills/README.md](skills/README.md) for details.

## Disclaimer

This project is **not** affiliated with, endorsed by, or sponsored by Microsoft Corporation. "Microsoft Teams" is a trademark of Microsoft Corporation.

## License

MIT
