import { Command } from "commander";
import { select } from "@inquirer/prompts";
import pc from "picocolors";
import { createSilentSpinner } from "../../../../utils/spinner.js";
import { runAz } from "../../../../utils/az.js";
import { isInteractive } from "../../../../utils/interactive.js";
import { logger } from "../../../../utils/logger.js";
import { CliError, wrapAction } from "../../../../utils/errors.js";
import { requireAzureBot } from "../require-azure.js";
import { ssoUpdateCommand } from "./edit.js";

interface AuthSetting {
  name: string;
  properties?: {
    serviceProviderDisplayName?: string;
    clientId?: string;
    scopes?: string;
    parameters?: Array<{ key: string; value: string }>;
  };
}

interface SsoConnection {
  name: string;
  tokenExchangeUrl: string;
  scopes: string;
}

export const ssoListCommand = new Command("list")
  .description("List SSO connections on an Azure bot")
  .argument("[appId]", "App ID")
  .action(wrapAction(async (appIdArg?: string) => {
    const { appId, botId, azure } = await requireAzureBot(appIdArg);

    const spinner = createSilentSpinner("Fetching SSO connections...").start();
    try {
      const settings = await runAz<AuthSetting[]>([
        "bot", "authsetting", "list",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--subscription", azure.subscription,
      ]);
      spinner.stop();

      const aadConnections = settings.filter((s) => {
        const provider = s.properties?.serviceProviderDisplayName ?? "";
        return provider.includes("Azure Active Directory");
      });

      if (aadConnections.length === 0) {
        logger.info(pc.dim("No SSO connections configured."));
        return;
      }

      // Fetch full details for each to check for tokenExchangeUrl
      const ssoConnections: SsoConnection[] = [];
      for (const setting of aadConnections) {
        const connectionName = setting.name.split("/").pop() ?? setting.name;
        try {
          const details = await runAz<AuthSetting>([
            "bot", "authsetting", "show",
            "--name", botId,
            "--resource-group", azure.resourceGroup,
            "--setting-name", connectionName,
            "--subscription", azure.subscription,
          ]);
          const tokenExchangeUrl = details.properties?.parameters?.find(
            (p) => p.key === "tokenExchangeUrl" && p.value,
          )?.value;
          if (tokenExchangeUrl) {
            const scopes = details.properties?.scopes ?? "";
            ssoConnections.push({ name: connectionName, tokenExchangeUrl, scopes });
            logger.info(`${pc.bold(connectionName)} ${pc.dim(tokenExchangeUrl)} ${pc.dim(`scopes: ${scopes}`)}`);
          }
        } catch {
          // Skip connections we can't read
        }
      }

      if (ssoConnections.length === 0) {
        logger.info(pc.dim("No SSO connections configured."));
        return;
      }

      // In interactive mode, offer to edit
      if (isInteractive() && ssoConnections.length > 0) {
        const action = await select({
          message: "Action",
          choices: [
            ...ssoConnections.map((c) => ({ name: `Edit "${c.name}"`, value: c.name })),
            { name: "Back", value: "back" },
          ],
        });

        if (action !== "back") {
          await ssoUpdateCommand.parseAsync([appId, "--connection-name", action], { from: "user" });
        }
      }
    } catch (error) {
      spinner.error({ text: "Failed to list SSO connections" });
      throw new CliError("API_ERROR", error instanceof Error ? error.message : "Failed to list SSO connections");
    }
  }));
