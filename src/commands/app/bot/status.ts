import { Command } from "commander";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { fetchApp, fetchAppDetailsV2, getBotLocation } from "../../../apps/index.js";
import { pickApp } from "../../../utils/app-picker.js";
import { isInteractive } from "../../../utils/interactive.js";

export const botStatusCommand = new Command("status")
  .description("Show bot location (BF tenant or Azure)")
  .argument("[appId]", "App ID")
  .action(async (appIdArg?: string) => {
    let token: string;
    let appId: string;

    if (appIdArg) {
      const account = await getAccount();
      if (!account) {
        console.log(pc.red("Not logged in.") + ` Run ${pc.cyan("teams login")} first.`);
        process.exit(1);
      }
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
    const spinner = createSpinner("Checking bot location...").start();
    const location = await getBotLocation(token, botId);
    spinner.stop();

    if (isInteractive()) {
      const label = location === "bf" ? "BF tenant" : "Azure";
      console.log(`${pc.dim("Bot ID:")} ${botId}`);
      console.log(`${pc.dim("Location:")} ${label}`);
    } else {
      // Plain output for scripting
      console.log(location);
    }
  });
