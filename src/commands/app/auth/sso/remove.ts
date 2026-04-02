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
    parameters?: Array<{ key: string; value: string }>;
  };
}

export const ssoRemoveCommand = new Command("remove")
  .description("Remove an SSO connection and clean up manifest")
  .argument("[appId]", "App ID")
  .option("--connection-name <name>", "SSO connection name to remove")
  .action(async (appIdArg: string | undefined, options: { connectionName?: string }) => {
    const { token, appId, botId, azure } = await requireAzureBot(appIdArg);

    let connectionName = options.connectionName;
    if (!connectionName) {
      if (!isInteractive()) {
        logger.error("--connection-name is required in non-interactive mode");
        process.exit(1);
      }

      // List SSO connections and let user pick
      const settings = runAz<AuthSetting[]>([
        "bot", "authsetting", "list",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--subscription", azure.subscription,
      ]);

      // Filter to Aadv2 connections (list doesn't return parameters)
      const ssoConnections = settings.filter((s) => {
        const provider = s.properties?.serviceProviderDisplayName ?? "";
        return provider.includes("Azure Active Directory");
      });

      if (ssoConnections.length === 0) {
        console.log(pc.dim("No SSO connections to remove."));
        return;
      }

      const choices = ssoConnections.map((s) => {
        const name = s.name.split("/").pop() ?? s.name;
        return { name, value: name };
      });

      connectionName = await search<string>({
        message: "Select SSO connection to remove",
        source: (term) => {
          if (!term) return choices;
          return choices.filter((c) => c.value.toLowerCase().includes(term.toLowerCase()));
        },
      });
    }

    // Remove the OAuth connection
    const spinner = createSpinner(`Removing SSO connection "${connectionName}"...`).start();
    try {
      runAz([
        "bot", "authsetting", "delete",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--setting-name", connectionName,
        "--subscription", azure.subscription,
      ]);
      spinner.success({ text: `SSO connection "${connectionName}" removed` });
    } catch (error) {
      spinner.error({ text: "Failed to remove SSO connection" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }

  });
