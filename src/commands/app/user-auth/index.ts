import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { oauthCommand } from "./oauth/index.js";
import { ssoCommand } from "./sso/index.js";
import { isInteractive } from "../../../utils/interactive.js";

export const userAuthCommand = new Command("user-auth")
  .description("Manage user authentication")
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
          message: "User authentication",
          choices: [
            { name: "OAuth connections", value: "oauth" },
            { name: "SSO", value: "sso" },
            { name: "Back", value: "back" },
          ],
        });

        if (action === "back") return;

        if (action === "oauth") {
          await oauthCommand.parseAsync(args, { from: "user" });
        } else if (action === "sso") {
          await ssoCommand.parseAsync(args, { from: "user" });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") return;
        throw error;
      }
    }
  });

userAuthCommand.addCommand(oauthCommand);
userAuthCommand.addCommand(ssoCommand);
