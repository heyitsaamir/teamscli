#!/usr/bin/env node
import { program } from "commander";
import { loginCommand, logoutCommand } from "./commands/auth/index.js";
import { statusCommand } from "./commands/status.js";
import { appCommand } from "./commands/app/index.js";

program
  .name("teams")
  .description("CLI for scaffolding Teams applications")
  .version("1.0.0");

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(statusCommand);
program.addCommand(appCommand);

program.parse();
