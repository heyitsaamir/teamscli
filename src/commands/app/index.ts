import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { appListCommand, runAppList } from "./list.js";
import { appCreateCommand } from "./create.js";
import { appViewCommand } from "./view.js";
import { appEditCommand } from "./edit.js";
import { appPackageCommand } from "./package/index.js";
import { appManifestCommand } from "./manifest/index.js";
import { authCommand } from "./auth/index.js";
import { isInteractive } from "../../utils/interactive.js";

export const appCommand = new Command("app")
  .description("Manage Teams apps")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    while (true) {
      try {
        const action = await select({
          message: "What would you like to do?",
          choices: [
            { name: "List apps", value: "list" },
            { name: "Create app", value: "create" },
            { name: "View app", value: "view" },
            { name: "Edit app", value: "edit" },
            { name: "Download package", value: "package" },
            { name: "Manifest", value: "manifest" },
            { name: "Generate secret", value: "secret" },
            { name: "Exit", value: "exit" },
          ],
        });

        if (action === "exit") return;

        if (action === "list") {
          await runAppList();
        } else if (action === "create") {
          await appCreateCommand.parseAsync([], { from: "user" });
        } else if (action === "view") {
          await appViewCommand.parseAsync([], { from: "user" });
        } else if (action === "edit") {
          await appEditCommand.parseAsync([], { from: "user" });
        } else if (action === "package") {
          const { packageDownloadCommand } = await import("./package/download.js");
          await packageDownloadCommand.parseAsync([], { from: "user" });
        } else if (action === "manifest") {
          await appManifestCommand.parseAsync([], { from: "user" });
        } else if (action === "secret") {
          const { secretCreateCommand } = await import("./auth/secret/create.js");
          await secretCreateCommand.parseAsync([], { from: "user" });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") {
          return;
        }
        throw error;
      }
    }
  });

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
