import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { oauthCommand } from "./oauth/index.js";
import { ssoCommand } from "./sso/index.js";
import { isInteractive } from "../../../utils/interactive.js";

export const userAuthCommand = new Command("user-auth")
  .description("Manage user authentication")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

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
        await oauthCommand.parseAsync([], { from: "user" });
      } else if (action === "sso") {
        await ssoCommand.parseAsync([], { from: "user" });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") return;
      throw error;
    }
  });

userAuthCommand.addCommand(oauthCommand);
userAuthCommand.addCommand(ssoCommand);
