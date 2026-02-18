import { Command } from "commander";
import pc from "picocolors";
import AdmZip from "adm-zip";
import { writeFile } from "node:fs/promises";
import { createSpinner } from "nanospinner";
import { appListCommand, runAppList } from "./list.js";
import { appCreateCommand } from "./create.js";
import { manifestCommand } from "./manifest/index.js";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../auth/index.js";
import { fetchApp, showAppHome, downloadAppPackage } from "../../apps/index.js";

export const appCommand = new Command("app")
  .description("Manage Teams apps")
  .option("--id <appId>", "Go directly to app details by ID")
  .option("--download-manifest [path]", "Download manifest (displays to stdout if no path)")
  .option("--download-package <path>", "Download full app package to file")
  .action(async (options) => {
    if (!options.id) {
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

      if (options.downloadManifest !== undefined) {
        const spinner = createSpinner("Downloading package...").start();
        const packageBuffer = await downloadAppPackage(token, app.appId);
        spinner.stop();
        const zip = new AdmZip(packageBuffer);
        const manifestEntry = zip.getEntry("manifest.json");

        if (!manifestEntry) {
          console.log(pc.red("manifest.json not found in package"));
          process.exit(1);
        }

        const manifestContent = manifestEntry.getData().toString("utf-8");
        const manifestJson = JSON.parse(manifestContent);

        if (typeof options.downloadManifest === "string") {
          await writeFile(options.downloadManifest, JSON.stringify(manifestJson, null, 2));
          console.log(pc.green(`Manifest saved to ${options.downloadManifest}`));
        } else {
          console.log(JSON.stringify(manifestJson, null, 2));
        }
        return;
      }

      if (options.downloadPackage) {
        const spinner = createSpinner("Downloading package...").start();
        const packageBuffer = await downloadAppPackage(token, app.appId);
        spinner.stop();
        await writeFile(options.downloadPackage, packageBuffer);
        console.log(pc.green(`Package saved to ${options.downloadPackage}`));
        return;
      }

      await showAppHome(app, token);
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });

export const appsCommand = new Command("apps")
  .description("List Teams apps (alias for 'app list')")
  .action(async () => {
    await runAppList();
  });

appCommand.addCommand(appListCommand);
appCommand.addCommand(appCreateCommand);
appCommand.addCommand(manifestCommand);
