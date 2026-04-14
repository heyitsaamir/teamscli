import { Command } from "commander";
import { select } from "@inquirer/prompts";
import pc from "picocolors";
import { createSilentSpinner } from "../../../../utils/spinner.js";
import { ssoSetupCommand } from "./setup.js";
import { ssoListCommand } from "./list.js";
import { ssoUpdateCommand } from "./edit.js";
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
  .argument("[appId]", "App ID")
  .action(async function (this: Command, appIdArg?: string) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    let azureBotContext: Awaited<ReturnType<typeof requireAzureBot>>;
    try {
      azureBotContext = await requireAzureBot(appIdArg);
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") return;
      throw error;
    }

    const { appId, botId, azure } = azureBotContext;

    while (true) {
      try {
        // Fetch existing SSO connections
        const listSpinner = createSilentSpinner("Fetching SSO connections...").start();
        let settings: AuthSetting[];
        try {
          settings = await runAz<AuthSetting[]>([
            "bot", "authsetting", "list",
            "--name", botId,
            "--resource-group", azure.resourceGroup,
            "--subscription", azure.subscription,
          ]);
        } finally {
          listSpinner.stop();
        }

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
          await ssoUpdateCommand.parseAsync([appId, "--connection-name", connectionName], { from: "user" });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") return;
        throw error;
      }
    }
  });

ssoCommand.addCommand(ssoSetupCommand);
ssoCommand.addCommand(ssoListCommand);
ssoCommand.addCommand(ssoUpdateCommand);
ssoCommand.addCommand(ssoRemoveCommand);
