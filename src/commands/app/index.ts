import { Command } from "commander";
import pc from "picocolors";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../auth/index.js";
import { fetchApp, showAppHome } from "../../apps/index.js";
import { appListCommand, runAppList } from "./list.js";
import { appCreateCommand } from "./create.js";

export const appCommand = new Command("app")
  .description("Manage Teams apps")
  .option("--id <id>", "Go directly to app by ID")
  .action(async (options: { id?: string }) => {
    if (!options.id) {
      await runAppList();
      return;
    }

    const account = await getAccount();
    if (!account) {
      console.log(pc.red("Not logged in.") + ` Run ${pc.cyan("teams login")} first.`);
      process.exit(1);
    }

    const token = await getTokenSilent(teamsDevPortalScopes);
    if (!token) {
      console.log(pc.red("Failed to get token.") + ` Try ${pc.cyan("teams login")} again.`);
      process.exit(1);
    }

    try {
      const app = await fetchApp(token, options.id);
      await showAppHome(app, token);
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : "Failed to fetch app"));
      process.exit(1);
    }
  });

appCommand.addCommand(appListCommand);
appCommand.addCommand(appCreateCommand);
