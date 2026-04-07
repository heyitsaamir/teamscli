import { confirm } from "@inquirer/prompts";
import pc from "picocolors";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { fetchAppDetailsV2, getBotLocation, discoverAzureBot, type AzureContext } from "../../../apps/index.js";
import { pickApp } from "../../../utils/app-picker.js";
import { ensureAz } from "../../../utils/az.js";
import { isInteractive } from "../../../utils/interactive.js";
import { CliError } from "../../../utils/errors.js";
import { logger } from "../../../utils/logger.js";
import { botMigrateCommand } from "../bot/migrate.js";

export interface AzureBotInfo {
  token: string;
  appId: string;
  botId: string;
  azure: AzureContext;
}

/**
 * Shared preamble for commands that require an Azure bot.
 * Handles: auth check, app selection, bot location check, Azure discovery.
 * In interactive mode, offers to migrate if bot is in BF.
 */
export async function requireAzureBot(appIdArg?: string, silent = false): Promise<AzureBotInfo> {
  const account = await getAccount();
  if (!account) {
    throw new CliError("AUTH_REQUIRED", "Not logged in.", "Run `teams login` first.");
  }

  let token: string;
  let appId: string;

  if (appIdArg) {
    token = (await getTokenSilent(teamsDevPortalScopes))!;
    if (!token) {
      throw new CliError("AUTH_TOKEN_FAILED", "Failed to get token.", "Try `teams login` again.");
    }
    appId = appIdArg;
  } else {
    const picked = await pickApp();
    token = picked.token;
    appId = picked.app.teamsAppId;
  }

  const details = await fetchAppDetailsV2(token, appId);
  if (!details.bots || details.bots.length === 0) {
    throw new CliError("NOT_FOUND_BOT", "This app has no bots.");
  }

  const botId = details.bots[0].botId;
  const location = await getBotLocation(token, botId);

  if (location === "bf") {
    if (isInteractive()) {
      logger.info(pc.yellow("This feature requires an Azure bot."));

      const migrate = await confirm({
        message: "Would you like to migrate this bot to Azure now?",
        default: true,
      });

      if (migrate) {
        await botMigrateCommand.parseAsync([appId], { from: "user" });

        const newLocation = await getBotLocation(token, botId);
        if (newLocation !== "azure") {
          throw new CliError("API_ERROR", "Migration did not complete. Cannot proceed.");
        }
      } else {
        process.exit(0);
      }
    } else {
      throw new CliError("PERMISSION_AZURE_REQUIRED", "This feature requires an Azure bot.", `Run \`teams app bot migrate ${appId}\` first.`);
    }
  }

  ensureAz();
  const azure = discoverAzureBot(botId, silent);
  if (!azure) {
    throw new CliError("NOT_FOUND_AZURE_BOT", "Could not find this bot in Azure.");
  }

  return { token, appId, botId, azure };
}
