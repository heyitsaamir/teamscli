import { Command } from "commander";
import { appListCommand, runAppList } from "./list.js";
import { appCreateCommand } from "./create.js";
import { appViewCommand } from "./view.js";
import { appEditCommand } from "./edit.js";
import { appPackageCommand } from "./package/index.js";
import { appManifestCommand } from "./manifest/index.js";
import { authCommand } from "./auth/index.js";

export const appCommand = new Command("app")
  .description("Manage Teams apps");

export const appsCommand = new Command("apps")
  .description("List Teams apps (alias for 'app list')")
  .action(async () => {
    await runAppList();
  });

appCommand.addCommand(appListCommand);
appCommand.addCommand(appCreateCommand);
appCommand.addCommand(appViewCommand);
appCommand.addCommand(appEditCommand);
appCommand.addCommand(appPackageCommand);
appCommand.addCommand(appManifestCommand);
appCommand.addCommand(authCommand);
