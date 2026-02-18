import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import AdmZip from "adm-zip";
import { writeFile } from "node:fs/promises";
import type { AppSummary } from "./types.js";
import { formatDate } from "../utils/date.js";
import { downloadAppPackage } from "./api.js";

export async function showAppHome(app: AppSummary, _token: string): Promise<void> {
  console.log(`\n${pc.bold(app.appName ?? "Unnamed")}`);
  console.log(`${pc.dim("ID:")} ${app.teamsAppId}`);
  console.log(`${pc.dim("Version:")} ${app.version ?? "N/A"}`);
  console.log(`${pc.dim("Updated:")} ${formatDate(app.updatedAt)}`);

  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "Edit name", value: "edit-name" },
      { name: "Edit endpoint", value: "edit-endpoint" },
      { name: "Download manifest", value: "download-manifest" },
      { name: "Download package", value: "download-package" },
      { name: "Back", value: "back" },
    ],
  });

  if (action === "back") {
    return;
  }

  if (action === "download-manifest") {
    const savePath = await input({
      message: "Enter path to save manifest (leave empty to display):",
    });

    const packageBuffer = await downloadAppPackage(_token, app.appId);
    const zip = new AdmZip(packageBuffer);
    const manifestEntry = zip.getEntry("manifest.json");

    if (!manifestEntry) {
      console.log(pc.red("\nmanifest.json not found in package"));
      return;
    }

    const manifestContent = manifestEntry.getData().toString("utf-8");
    const manifestJson = JSON.parse(manifestContent);

    if (savePath.trim()) {
      await writeFile(savePath.trim(), JSON.stringify(manifestJson, null, 2));
      console.log(pc.green(`\nManifest saved to ${savePath.trim()}`));
    } else {
      console.log(pc.dim("\n--- manifest.json ---"));
      console.log(JSON.stringify(manifestJson, null, 2));
    }
    return;
  }

  if (action === "download-package") {
    const defaultName = `${app.appName ?? "app"}.zip`;
    const savePath = await input({
      message: "Enter path to save package:",
      default: defaultName,
    });

    const packageBuffer = await downloadAppPackage(_token, app.appId);
    await writeFile(savePath.trim(), packageBuffer);
    console.log(pc.green(`\nPackage saved to ${savePath.trim()}`));
    return;
  }

  // TODO: Implement remaining actions
  console.log(pc.dim(`\n"${action}" not implemented yet.`));
}
