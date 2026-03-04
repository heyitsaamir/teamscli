import { Command } from "commander";
import { appListCommand, runAppList } from "./list.js";
import { appCreateCommand } from "./create.js";
import { appViewCommand } from "./view.js";
import { manifestCommand } from "./manifest/index.js";
import { generateSecretCommand } from "./generate-secret.js";
import { installLinkCommand } from "./install-link.js";

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
appCommand.addCommand(manifestCommand);
appCommand.addCommand(generateSecretCommand);
appCommand.addCommand(installLinkCommand);
