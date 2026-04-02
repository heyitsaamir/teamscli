import { Command } from "commander";
import { select } from "@inquirer/prompts";
import pc from "picocolors";
import { ssoSetupCommand } from "./setup.js";
import { ssoListCommand } from "./list.js";
import { ssoEditCommand } from "./edit.js";
import { ssoRemoveCommand } from "./remove.js";
import { isInteractive } from "../../../../utils/interactive.js";
import { runAz } from "../../../../utils/az.js";
import { requireAzureBot } from "../require-azure.js";

interface AuthSetting {
  name: string;
  properties?: {
    serviceProviderDisplayName?: string;
    scopes?: string;
    parameters?: Array<{ key: string; value: string }>;
  };
}

export const ssoCommand = new Command("sso")
  .description("Manage SSO configuration (Azure bots only)")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    try {
      const { appId, botId, azure } = await requireAzureBot();

      // Fetch existing SSO connections
      const settings = runAz<AuthSetting[]>([
        "bot", "authsetting", "list",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--subscription", azure.subscription,
      ]);

      const aadConnections = settings.filter((s) => {
        const provider = s.properties?.serviceProviderDisplayName ?? "";
        return provider.includes("Azure Active Directory");
      });

      const connectionChoices = aadConnections.map((s) => {
        const name = s.name.split("/").pop() ?? s.name;
        return {
          name: s.properties?.scopes ? `${name} ${pc.dim(`(${s.properties.scopes})`)}` : name,
          value: `edit:${name}`,
        };
      });

      const action = await select({
        message: "SSO",
        choices: [
          ...connectionChoices,
          { name: "Set up new SSO connection", value: "setup" },
          { name: "Back", value: "back" },
        ],
      });

      if (action === "back") return;

      if (action === "setup") {
        await ssoSetupCommand.parseAsync([appId], { from: "user" });
      } else if (action.startsWith("edit:")) {
        const connectionName = action.slice(5);
        await ssoEditCommand.parseAsync([appId, "--connection-name", connectionName], { from: "user" });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") return;
      throw error;
    }
  });

ssoCommand.addCommand(ssoSetupCommand);
ssoCommand.addCommand(ssoListCommand);
ssoCommand.addCommand(ssoEditCommand);
ssoCommand.addCommand(ssoRemoveCommand);
