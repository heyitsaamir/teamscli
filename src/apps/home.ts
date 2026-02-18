import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import AdmZip from "adm-zip";
import { writeFile } from "node:fs/promises";
import { createSpinner } from "nanospinner";
import type { AppSummary } from "./types.js";
import { formatDate } from "../utils/date.js";
import { fetchApp, downloadAppPackage } from "./api.js";
import { fetchBot, updateBot, type BotDetails } from "./tdp.js";

export async function showAppHome(appSummary: AppSummary, token: string): Promise<void> {
  const spinner = createSpinner("Fetching details...").start();

  // Fetch full app details to get bots array
  const app = await fetchApp(token, appSummary.teamsAppId);

  // Fetch bot details if app has bots
  let bot: BotDetails | null = null;
  if (app.bots && app.bots.length > 0) {
    try {
      bot = await fetchBot(token, app.bots[0].botId);
    } catch {
      // Bot fetch failed, skip showing endpoint
    }
  }

  spinner.stop();

  console.log(`\n${pc.bold(app.appName ?? "Unnamed")}`);
  console.log(`${pc.dim("ID:")} ${app.teamsAppId}`);
  console.log(`${pc.dim("Version:")} ${app.version ?? "N/A"}`);
  console.log(`${pc.dim("Updated:")} ${formatDate(app.updatedAt)}`);
  if (bot) {
    console.log(`${pc.dim("Endpoint:")} ${bot.messagingEndpoint || pc.dim("(not set)")}`);
  }

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

  if (action === "edit-endpoint") {
    if (!bot) {
      console.log(pc.red("\nThis app has no bots."));
      return;
    }

    const newEndpoint = await input({
      message: "Enter new messaging endpoint URL:",
      default: bot.messagingEndpoint,
    });

    if (newEndpoint.trim() === bot.messagingEndpoint) {
      console.log(pc.dim("\nNo changes made."));
      return;
    }

    const updateSpinner = createSpinner("Updating endpoint...").start();
    await updateBot(token, { ...bot, messagingEndpoint: newEndpoint.trim() });
    updateSpinner.success({ text: "Endpoint updated successfully" });
    return;
  }

  if (action === "download-manifest") {
    const savePath = await input({
      message: "Enter path to save manifest (leave empty to display):",
    });

    const spinner = createSpinner("Downloading package...").start();
    const packageBuffer = await downloadAppPackage(token, app.appId);
    spinner.stop();
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

    const spinner = createSpinner("Downloading package...").start();
    const packageBuffer = await downloadAppPackage(token, app.appId);
    spinner.stop();
    await writeFile(savePath.trim(), packageBuffer);
    console.log(pc.green(`\nPackage saved to ${savePath.trim()}`));
    return;
  }

  // TODO: Implement remaining actions
  console.log(pc.dim(`\n"${action}" not implemented yet.`));
}
