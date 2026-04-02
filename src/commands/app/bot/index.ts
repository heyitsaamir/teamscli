import { Command } from "commander";
import { botStatusCommand } from "./status.js";
import { botMigrateCommand } from "./migrate.js";

export const botCommand = new Command("bot")
  .description("Manage bot registration");

botCommand.addCommand(botStatusCommand);
botCommand.addCommand(botMigrateCommand);
