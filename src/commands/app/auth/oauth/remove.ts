import { Command } from "commander";
import { search } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { runAz } from "../../../../utils/az.js";
import { isInteractive } from "../../../../utils/interactive.js";
import { logger } from "../../../../utils/logger.js";
import { requireAzureBot } from "../require-azure.js";

interface AuthSetting {
  name: string;
  properties?: {
    serviceProviderDisplayName?: string;
  };
}

export const oauthRemoveCommand = new Command("remove")
  .description("Remove an OAuth connection from an Azure bot")
  .argument("[appId]", "App ID")
  .option("--connection-name <name>", "OAuth connection name to remove")
  .action(async (appIdArg: string | undefined, options: { connectionName?: string }) => {
    const { botId, azure } = await requireAzureBot(appIdArg);

    let connectionName = options.connectionName;
    if (!connectionName) {
      if (!isInteractive()) {
        logger.error("--connection-name is required in non-interactive mode");
        process.exit(1);
      }

      // List connections and let user pick
      const settings = runAz<AuthSetting[]>([
        "bot", "authsetting", "list",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--subscription", azure.subscription,
      ]);

      if (settings.length === 0) {
        console.log(pc.dim("No OAuth connections to remove."));
        return;
      }

      const choices = settings.map((s) => {
        const name = s.name.split("/").pop() ?? s.name;
        const provider = s.properties?.serviceProviderDisplayName ?? "";
        return {
          name: `${name}${provider ? ` ${pc.dim(`(${provider})`)}` : ""}`,
          value: name,
        };
      });

      connectionName = await search<string>({
        message: "Select connection to remove",
        source: (term) => {
          if (!term) return choices;
          return choices.filter((c) => c.value.toLowerCase().includes(term.toLowerCase()));
        },
      });
    }

    const spinner = createSpinner(`Removing "${connectionName}"...`).start();
    try {
      runAz([
        "bot", "authsetting", "delete",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--setting-name", connectionName,
        "--subscription", azure.subscription,
      ]);
      spinner.success({ text: `OAuth connection "${connectionName}" removed` });
    } catch (error) {
      spinner.error({ text: "Failed to remove OAuth connection" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  });
