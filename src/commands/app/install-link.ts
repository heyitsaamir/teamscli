import { Command } from "commander";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../auth/index.js";
import { fetchApp } from "../../apps/index.js";
import { appContext } from "./context.js";

export const installLinkCommand = new Command("install-link")
  .description("Get the Teams installation link for an app (requires --id on parent app command)")
  .action(async () => {
    const id = appContext.appId;
    if (!id) {
      console.log(pc.red("Missing required option: --id <appId>"));
      console.log(pc.dim("Usage: teams2 app --id <appId> install-link"));
      process.exit(1);
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

    const spinner = createSpinner("Fetching app details...").start();

    try {
      const app = await fetchApp(token, id);
      spinner.success({ text: "App found" });

      const installLink = `https://teams.microsoft.com/l/app/${app.teamsAppId}?installAppPackage=true`;

      console.log(`\n${pc.dim("App:")} ${app.appName || app.appId}`);
      console.log(`${pc.dim("Install link:")} ${installLink}`);
    } catch (error) {
      spinner.error({ text: "Failed to fetch app details" });
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
