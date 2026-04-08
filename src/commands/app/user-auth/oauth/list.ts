import { Command } from "commander";
import pc from "picocolors";
import { createSilentSpinner } from "../../../../utils/spinner.js";
import { runAz } from "../../../../utils/az.js";
import { logger } from "../../../../utils/logger.js";
import { CliError, wrapAction } from "../../../../utils/errors.js";
import { outputJson } from "../../../../utils/json-output.js";
import { requireAzureBot } from "../require-azure.js";

interface AuthSetting {
  name: string;
  properties?: {
    serviceProviderDisplayName?: string;
    clientId?: string;
    scopes?: string;
  };
}

export const oauthListCommand = new Command("list")
  .description("List OAuth connections on an Azure bot")
  .argument("[appId]", "App ID")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(wrapAction(async (appIdArg: string | undefined, options: { json?: boolean }) => {
    const { botId, azure } = await requireAzureBot(appIdArg);

    const spinner = createSilentSpinner("Fetching OAuth connections...").start();
    try {
      const settings = await runAz<AuthSetting[]>([
        "bot", "authsetting", "list",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--subscription", azure.subscription,
      ]);
      spinner.stop();

      if (options.json) {
        outputJson(settings);
        return;
      }

      if (settings.length === 0) {
        logger.info(pc.dim("No OAuth connections configured."));
        return;
      }

      for (const setting of settings) {
        // Extract connection name from the full resource name (last segment)
        const connectionName = setting.name.split("/").pop() ?? setting.name;
        const provider = setting.properties?.serviceProviderDisplayName ?? "Unknown";
        const clientId = setting.properties?.clientId ?? "";
        logger.info(`${pc.bold(connectionName)} ${pc.dim(`(${provider})`)}${clientId ? ` ${pc.dim(clientId)}` : ""}`);
      }
    } catch (error) {
      spinner.error({ text: "Failed to list OAuth connections" });
      throw new CliError("API_ERROR", error instanceof Error ? error.message : "Failed to list OAuth connections");
    }
  }));
