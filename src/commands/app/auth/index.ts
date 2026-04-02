import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { secretCommand } from "./secret/index.js";
import { oauthCommand } from "./oauth/index.js";
import { ssoCommand } from "./sso/index.js";
import { isInteractive } from "../../../utils/interactive.js";

export const authCommand = new Command("auth")
  .description("Manage app authentication")
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

// secret is still a subcommand for CLI access (teams2 app auth secret create)
// but not shown in the interactive menu since it's about bot identity, not user auth
authCommand.addCommand(secretCommand);
authCommand.addCommand(oauthCommand);
authCommand.addCommand(ssoCommand);
