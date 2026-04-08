#!/usr/bin/env node
import { createRequire } from "node:module";
import { program, type Command } from "commander";
import { loginCommand, logoutCommand } from "./commands/auth/index.js";
import { statusCommand } from "./commands/status.js";
import { appCommand, appsCommand } from "./commands/app/index.js";
import { scaffoldCommand } from "./commands/scaffold/index.js";
import { selfUpdateCommand } from "./commands/self-update.js";
import { configCommand } from "./commands/config/index.js";
import { logsCommand } from "./commands/logs.js";
import { CliError } from "./utils/errors.js";
import { logger, setVerbose } from "./utils/logger.js";
import { isInteractive, setAutoConfirm } from "./utils/interactive.js";
import { checkForUpdates } from "./utils/update-check.js";
import { initSessionLog, logToSession } from "./utils/session-log.js";
import pc from "picocolors";

// Start a new session log for this invocation immediately, before any other work.
initSessionLog();

// Safety net: catch CliError thrown from shared utilities in non-wrapped commands
process.on("unhandledRejection", (error) => {
  if (error instanceof CliError) {
    logger.error(pc.red(error.message));
    if (error.suggestion) logger.error(error.suggestion);
  } else {
    logger.error(pc.red(error instanceof Error ? error.message : "Unknown error"));
  }
  process.exit(1);
});

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

// Teams brand purple (#7B83EB) via truecolor escape
function teamsColor(text: string): string {
  if (!process.stdout.isTTY) return text;
  return `\x1b[38;2;123;131;235m${text}\x1b[39m`;
}

program
  .name("teams")
  .addHelpText("beforeAll", `${pc.bold(teamsColor("Teams CLI"))} ${pc.bold(pc.yellow("[Beta]"))}\nWork seamlessly with Teams apps from the command line.\n`)
  .version(version)
  .option("-v, --verbose", "[OPTIONAL] Enable verbose logging")
  .option("-y, --yes", "[OPTIONAL] Auto-confirm prompts (for CI/agent use)")
  .option("--disable-auto-update", "[OPTIONAL] Disable automatic updates")
  .addHelpText("after", () => {
    const status = isInteractive() ? pc.green("on") : pc.yellow("off");
    return `\nInteractive mode: ${status}\n  Set ${pc.cyan("TEAMS_NO_INTERACTIVE=1")} to disable, unset to enable.`;
  })
  .hook("preAction", async (thisCommand, actionCommand) => {
    const opts = thisCommand.optsWithGlobals();
    if (opts.verbose) {
      setVerbose(true);
    }
    if (opts.yes) {
      setAutoConfirm(true);
    }

    // Log the resolved command path (e.g. "app create", "auth login") for tracing.
    const parts: string[] = [];
    let cmd: Command | null = actionCommand;
    while (cmd && cmd.name() && cmd.name() !== "teams") {
      parts.unshift(cmd.name());
      cmd = cmd.parent;
    }
    logToSession("CMD", `executing: ${parts.join(" ") || actionCommand.name()}`);

    if (actionCommand.name() !== "self-update") {
      await checkForUpdates({ autoUpdate: !opts.disableAutoUpdate });
    }
  });

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(statusCommand);
program.addCommand(appCommand);
program.addCommand(appsCommand);
program.addCommand(scaffoldCommand);
program.addCommand(selfUpdateCommand);
program.addCommand(configCommand);
program.addCommand(logsCommand);

program.parse();
