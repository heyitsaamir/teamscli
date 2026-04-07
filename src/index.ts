#!/usr/bin/env node
import { createRequire } from "node:module";
import { program } from "commander";
import { loginCommand, logoutCommand } from "./commands/auth/index.js";
import { statusCommand } from "./commands/status.js";
import { appCommand, appsCommand } from "./commands/app/index.js";
import { scaffoldCommand } from "./commands/scaffold/index.js";
import { selfUpdateCommand } from "./commands/self-update.js";
import { configCommand } from "./commands/config/index.js";
import { CliError } from "./utils/errors.js";
import { logger, setVerbose } from "./utils/logger.js";
import { isInteractive } from "./utils/interactive.js";
import { checkForUpdates } from "./utils/update-check.js";
import pc from "picocolors";

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

program
  .name("teams")
  .description("CLI for scaffolding Teams applications")
  .version(version)
  .option("-v, --verbose", "[OPTIONAL] Enable verbose logging")
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

program.parse();
