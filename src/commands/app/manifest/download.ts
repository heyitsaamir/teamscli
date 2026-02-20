import { Command } from "commander";
import AdmZip from "adm-zip";
import { writeFile } from "node:fs/promises";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { downloadAppPackage } from "../../../apps/index.js";
import { appContext } from "../context.js";

export const manifestDownloadCommand = new Command("download")
  .description("Download manifest from a Teams app (requires --id on parent app command)")
  .argument("[file-path]", "Output file path (displays to stdout if not provided)")
  .action(async (filePath: string | undefined) => {
    const id = appContext.appId;
    if (!id) {
      console.log(pc.red("Missing required option: --id <appId>"));
      console.log(pc.dim("Usage: teams app --id <appId> manifest download [file-path]"));
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

    const spinner = createSpinner("Downloading manifest...").start();

    try {
      const packageBuffer = await downloadAppPackage(token, id);
      const zip = new AdmZip(packageBuffer);
      const manifestEntry = zip.getEntry("manifest.json");

      if (!manifestEntry) {
        spinner.error({ text: "manifest.json not found in package" });
        process.exit(1);
      }

      const manifestContent = manifestEntry.getData().toString("utf-8");
      const manifestJson = JSON.parse(manifestContent);

      spinner.success({ text: "Manifest downloaded" });

      if (filePath) {
        await writeFile(filePath, JSON.stringify(manifestJson, null, 2));
        console.log(pc.green(`Manifest saved to ${filePath}`));
      } else {
        console.log(JSON.stringify(manifestJson, null, 2));
      }
    } catch (error) {
      spinner.error({ text: "Failed to download manifest" });
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
