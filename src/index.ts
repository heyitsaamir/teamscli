#!/usr/bin/env node
import { program } from "commander";
import { loginCommand, logoutCommand } from "./commands/auth/index.js";
import { statusCommand } from "./commands/status.js";
import { appCommand, appsCommand } from "./commands/app/index.js";
import { setVerbose } from "./utils/logger.js";

program
  .name("teams2")
  .description("CLI for scaffolding Teams applications")
  .version("1.0.0")
  .option("-v, --verbose", "[OPTIONAL] Enable verbose logging")
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

program.parse();
