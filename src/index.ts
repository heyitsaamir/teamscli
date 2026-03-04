#!/usr/bin/env node
import { createRequire } from "node:module";
import { program } from "commander";
import { loginCommand, logoutCommand } from "./commands/auth/index.js";
import { statusCommand } from "./commands/status.js";
import { appCommand, appsCommand } from "./commands/app/index.js";
import { scaffoldCommand } from "./commands/scaffold/index.js";
import { selfUpdateCommand } from "./commands/self-update.js";
import { setVerbose } from "./utils/logger.js";
import { isInteractive } from "./utils/interactive.js";
import pc from "picocolors";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

program
  .name("teams2")
  .description("CLI for scaffolding Teams applications")
  .version(version)
  .option("-v, --verbose", "[OPTIONAL] Enable verbose logging")
  .addHelpText("after", () => {
    const status = isInteractive() ? pc.green("on") : pc.yellow("off");
    return `\nInteractive mode: ${status}\n  Set ${pc.cyan("TEAMS_NO_INTERACTIVE=1")} to disable, unset to enable.`;
  })
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    if (opts.verbose) {
      setVerbose(true);
    }
  });

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(statusCommand);
program.addCommand(appCommand);
program.addCommand(appsCommand);
program.addCommand(scaffoldCommand);
program.addCommand(selfUpdateCommand);

program.parse();
