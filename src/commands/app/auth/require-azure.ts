import { confirm } from "@inquirer/prompts";
import pc from "picocolors";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { fetchAppDetailsV2, getBotLocation, discoverAzureBot, type AzureContext } from "../../../apps/index.js";
import { pickApp } from "../../../utils/app-picker.js";
import { ensureAz } from "../../../utils/az.js";
import { isInteractive } from "../../../utils/interactive.js";
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
    console.log(pc.red("Not logged in.") + ` Run ${pc.cyan("teams login")} first.`);
    process.exit(1);
  }

  let token: string;
  let appId: string;

  if (appIdArg) {
    token = (await getTokenSilent(teamsDevPortalScopes))!;
    if (!token) {
      console.log(pc.red("Failed to get token.") + ` Try ${pc.cyan("teams login")} again.`);
      process.exit(1);
    }
    appId = appIdArg;
  } else {
    const picked = await pickApp();
    token = picked.token;
    appId = picked.app.teamsAppId;
  }

  const details = await fetchAppDetailsV2(token, appId);
  if (!details.bots || details.bots.length === 0) {
    console.log(pc.red("This app has no bots."));
    process.exit(1);
  }

  const botId = details.bots[0].botId;
  const location = await getBotLocation(token, botId);

  if (location === "bf") {
    console.log(pc.yellow("This feature requires an Azure bot."));

    if (isInteractive()) {
      const migrate = await confirm({
        message: "Would you like to migrate this bot to Azure now?",
        default: true,
      });

      if (migrate) {
        await botMigrateCommand.parseAsync([appId], { from: "user" });

        // Re-check — migration should have moved it to Azure
        const newLocation = await getBotLocation(token, botId);
        if (newLocation !== "azure") {
          console.log(pc.red("Migration did not complete. Cannot proceed."));
          process.exit(1);
        }
      } else {
        process.exit(0);
      }
    } else {
      console.log(`Run ${pc.cyan(`teams app bot migrate ${appId}`)} first.`);
      process.exit(1);
    }
  }

  ensureAz();
  const azure = discoverAzureBot(botId, silent);
  if (!azure) {
    console.log(pc.red("Could not find this bot in Azure."));
    process.exit(1);
  }

  return { token, appId, botId, azure };
}
