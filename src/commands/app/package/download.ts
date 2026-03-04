import { Command } from "commander";
import pc from "picocolors";
import { writeFile } from "node:fs/promises";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { fetchApp, downloadAppPackage } from "../../../apps/index.js";
import { pickApp } from "../../../utils/app-picker.js";

export const packageDownloadCommand = new Command("download")
  .description("Download a Teams app package")
  .argument("[appId]", "App ID")
  .option("-o, --output <path>", "[OPTIONAL] Output file path (defaults to <appName>.zip)")
  .action(async (appIdArg: string | undefined, options) => {
    let appId: string;
    let token: string;

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
      appId = picked.app.teamsAppId;
      token = picked.token;
    }

    try {
      const app = await fetchApp(token, appId);
      const outputPath = options.output || `${(app.appName || app.appId).replace(/\s+/g, "-")}.zip`;

      const spinner = createSpinner("Downloading package...").start();
      const packageBuffer = await downloadAppPackage(token, app.appId);
      spinner.stop();

      await writeFile(outputPath, packageBuffer);
      console.log(pc.green(`Package saved to ${outputPath}`));
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
