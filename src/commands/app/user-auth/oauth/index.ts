import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { oauthAddCommand } from "./add.js";
import { oauthListCommand } from "./list.js";
import { oauthRemoveCommand } from "./remove.js";
import { isInteractive } from "../../../../utils/interactive.js";

export const oauthCommand = new Command("oauth")
  .description("Manage OAuth connections (Azure bots only)")
  .argument("[appId]", "App ID")
  .action(async function (this: Command, appId?: string) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    const args = appId ? [appId] : [];

    while (true) {
      try {
        const action = await select({
          message: "OAuth connections",
          choices: [
            { name: "Add connection", value: "add" },
            { name: "List connections", value: "list" },
            { name: "Remove connection", value: "remove" },
            { name: "Back", value: "back" },
          ],
        });

        if (action === "back") return;

        if (action === "add") {
          await oauthAddCommand.parseAsync(args, { from: "user" });
        } else if (action === "list") {
          await oauthListCommand.parseAsync(args, { from: "user" });
        } else if (action === "remove") {
          await oauthRemoveCommand.parseAsync(args, { from: "user" });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") return;
        throw error;
      }
    }
  });

oauthCommand.addCommand(oauthAddCommand);
oauthCommand.addCommand(oauthListCommand);
oauthCommand.addCommand(oauthRemoveCommand);
