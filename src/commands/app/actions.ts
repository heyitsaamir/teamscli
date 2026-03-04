import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import { writeFile } from "node:fs/promises";
import { createSpinner } from "nanospinner";
import { showEditMenu } from "./edit.js";
import { showAppDetail, downloadAppPackage } from "../../apps/index.js";
import { downloadManifest, uploadManifestFromFile } from "./manifest/actions.js";
import { generateSecret } from "./auth/secret/generate.js";
import type { AppSummary } from "../../apps/types.js";

/**
 * Show an action submenu for a specific app.
 * Returns when user selects "Back".
 */
export async function showAppActions(app: AppSummary, token: string): Promise<void> {
  while (true) {
    const action = await select({
      message: `${app.appName ?? "Unnamed"}:`,
      choices: [
        { name: "View", value: "view" },
        { name: "Edit", value: "edit" },
        { name: "Download package", value: "package" },
        { name: "Manifest", value: "manifest" },
        { name: "Generate secret", value: "secret" },
        { name: "Back", value: "back" },
      ],
    });

    if (action === "back") return;

    if (action === "view") {
      await showAppDetail(app, token, { interactive: true });
    } else if (action === "edit") {
      await showEditMenu(app, token);
    } else if (action === "package") {
      const outputPath = `${(app.appName || app.appId).replace(/\s+/g, "-")}.zip`;
      const spinner = createSpinner("Downloading package...").start();
      const packageBuffer = await downloadAppPackage(token, app.appId);
      spinner.stop();
      await writeFile(outputPath, packageBuffer);
      console.log(pc.green(`Package saved to ${outputPath}`));
    } else if (action === "manifest") {
      const manifestAction = await select({
        message: `${app.appName ?? "Unnamed"} — manifest:`,
        choices: [
          { name: "Download", value: "download" },
          { name: "Upload", value: "upload" },
          { name: "Back", value: "back" },
        ],
      });

      if (manifestAction === "download") {
        const savePath = await input({
          message: "Save to (leave empty to print):",
          default: "",
        });
        try {
          await downloadManifest(token, app.appId, savePath || undefined);
        } catch (error) {
          console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
        }
      } else if (manifestAction === "upload") {
        const filePath = await input({
          message: "Path to manifest.json:",
          default: "manifest.json",
        });
        try {
          await uploadManifestFromFile(token, app.teamsAppId, filePath);
        } catch (error) {
          console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
        }
      }
    } else if (action === "secret") {
      try {
        await generateSecret({ tdpToken: token, appId: app.teamsAppId, interactive: true });
      } catch (error) {
        console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      }
    }
  }
}
