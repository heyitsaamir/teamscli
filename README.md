# teams2

CLI for scaffolding Teams applications.

## Install

```bash
npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
```

## Usage

```bash
teams2
```

This launches an interactive CLI. You can also run specific commands directly:

```bash
teams2 login       # Sign in with your Microsoft account
teams2 logout      # Sign out
teams2 status      # Check authentication status
teams2 app         # Manage a Teams app (create, update, manifest)
teams2 apps        # List your Teams apps
```

Use `-v` or `--verbose` to enable verbose logging.

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
