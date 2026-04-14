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
│   ├── get [appId]                Get a Teams app
│   ├── update [appId]             Update app properties
│   ├── doctor [appId]             Run diagnostic checks
│   ├── manifest
│   │   ├── download [appId]       Download manifest
│   │   └── upload [appId]         Upload manifest
│   ├── package
│   │   └── download [appId]       Download app package
│   ├── bot
│   │   ├── get [appId]            Get bot location
│   │   └── migrate [appId]        Migrate bot to Azure
│   ├── rsc
│   │   ├── list <teamsAppId>      List RSC permissions
│   │   ├── add <teamsAppId>       Add RSC permission
│   │   ├── remove <teamsAppId>    Remove RSC permission
│   │   └── set <teamsAppId>       Declaratively set RSC permissions
│   ├── auth
│   │   └── secret
│   │       └── create [appId]     Generate client secret
│   └── user-auth
│       ├── oauth
│       │   ├── add [appId]        Add OAuth connection
│       │   ├── list [appId]       List OAuth connections
│       │   └── remove [appId]     Remove OAuth connection
│       └── sso
│           ├── setup [appId]      Set up SSO
│           ├── list [appId]       List SSO connections
│           ├── update [appId]     Update SSO connection
│           └── remove [appId]     Remove SSO connection
├── project                        Create and configure Teams app projects
│   ├── new                        Create a new Teams app project
│   │   ├── typescript <name>      Create a new TypeScript Teams app
│   │   ├── csharp <name>          Create a new C# Teams app
│   │   └── python <name>          Create a new Python Teams app
│   └── config                     Manage Agents Toolkit configuration
│       ├── add <name>             Add Agents Toolkit configuration
│       └── remove <name>          Remove Agents Toolkit configuration
├── config                         Manage CLI configuration
│   └── default-bot-location       Set default bot location
└── self-update                    Update to latest version
```

## Machine-Readable Help

Use `--help --json` on any command to get the command tree as structured JSON — useful for AI agents and tooling that need to discover CLI capabilities programmatically:

```bash
teams --help --json          # Full command tree with version
teams app --help --json      # Subtree for 'app'
teams app rsc --help --json  # Subtree for 'app rsc'
```

## Interactive vs Scripted

Most commands work in two modes:

- **Interactive** — omit the `[appId]` argument and the CLI presents a searchable app picker. Subcommands like `app`, `app user-auth`, and `app manifest` show action menus.
- **Scripted** — pass `[appId]` and all required flags directly for CI/CD or automation. Use `--json` where available for machine-readable output.

Set `TEAMS_NO_INTERACTIVE=1` to disable interactive prompts entirely.
