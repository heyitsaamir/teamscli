import { Command } from "commander";
import { appListCommand, runAppList } from "./list.js";
import { appCreateCommand } from "./create.js";

export const appCommand = new Command("app")
  .description("Manage Teams apps");

export const appsCommand = new Command("apps")
  .description("List Teams apps (alias for 'app list')")
  .action(async () => {
    await runAppList();
  });

appCommand.addCommand(appListCommand);
appCommand.addCommand(appCreateCommand);
