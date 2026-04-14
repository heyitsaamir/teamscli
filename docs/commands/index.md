# Command Reference

All teams commands. Run any command with `--help` for inline usage.

## Global Options

| Flag | Description |
|------|-------------|
| `-v, --verbose` | Enable verbose logging |
| `--disable-auto-update` | Disable automatic update checks |
| `--version` | Show version |
| `--help` | Show help |

## Command Tree

```
teams
├── login                          Log in to Microsoft 365
├── logout                         Log out of Microsoft 365
├── status                         Show current CLI status
├── apps                           List Teams apps (alias for app list)
├── app                            Manage Teams apps (interactive menu)
│   ├── list                       List your Teams apps
│   ├── create                     Create a new Teams app with bot
│   ├── view [appId]               View a Teams app
│   ├── edit [appId]               Edit app properties
│   ├── doctor [appId]             Run diagnostic checks
│   ├── manifest
│   │   ├── download [appId]       Download manifest
│   │   └── upload [appId]         Upload manifest
│   ├── package
│   │   └── download [appId]       Download app package
│   ├── bot
│   │   ├── status [appId]         Show bot location
│   │   └── migrate [appId]        Migrate bot to Azure
│   ├── rsc
│   │   ├── list <teamsAppId>      List RSC permissions
│   │   ├── add <teamsAppId>       Add RSC permission
│   │   └── remove <teamsAppId>    Remove RSC permission
│   └── auth
│       └── secret
│           └── create [appId]     Generate client secret
├── scaffold
│   └── manifest                   Create a manifest.json file
├── config                         Manage CLI configuration
│   └── default-bot-location       Set default bot location
└── self-update                    Update to latest version
```

## Interactive vs Scripted

Most commands work in two modes:

- **Interactive** — omit the `[appId]` argument and the CLI presents a searchable app picker. Subcommands like `app` and `app manifest` show action menus.
- **Scripted** — pass `[appId]` and all required flags directly for CI/CD or automation. Use `--json` where available for machine-readable output.

Set `TEAMS_NO_INTERACTIVE=1` to disable interactive prompts entirely.
