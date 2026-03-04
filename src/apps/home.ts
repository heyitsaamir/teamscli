import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import { writeFile } from "node:fs/promises";
import { createSpinner } from "nanospinner";
import type { AppSummary, AppDetails } from "./types.js";
import { fetchApp, downloadAppPackage, fetchAppDetailsV2 } from "./api.js";
import { fetchBot, type BotDetails } from "./tdp.js";

/**
 * Fetch and print app detail header. Returns the resolved details.
 */
async function printAppHeader(appSummary: AppSummary, token: string): Promise<{ appDetails: AppDetails; endpoint: string | null }> {
  const spinner = createSpinner("Fetching details...").start();

  let appDetails: AppDetails;
  try {
    appDetails = await fetchAppDetailsV2(token, appSummary.teamsAppId);
  } catch {
    const basicApp = await fetchApp(token, appSummary.teamsAppId);
    appDetails = {
      ...basicApp,
      shortName: basicApp.appName ?? "",
      longName: "",
      shortDescription: "",
      longDescription: "",
      developerName: "",
      websiteUrl: "",
      privacyUrl: "",
      termsOfUseUrl: "",
      manifestVersion: "",
      webApplicationInfoId: "",
      mpnId: "",
      accentColor: "",
    } as AppDetails;
  }

  let endpoint: string | null = null;
  if (appDetails.bots && appDetails.bots.length > 0) {
    try {
      const bot = await fetchBot(token, appDetails.bots[0].botId);
      endpoint = bot.messagingEndpoint || null;
    } catch {
      // Bot fetch failed, skip
    }
  }

  spinner.stop();

  console.log(`\n${pc.bold(appDetails.shortName || "Unnamed")}`);
  console.log(`${pc.dim("ID:")} ${appDetails.teamsAppId}`);
  console.log(`${pc.dim("Version:")} ${appDetails.version ?? "N/A"}`);
  if (appDetails.longName) {
    console.log(`${pc.dim("Long name:")} ${appDetails.longName}`);
  }
  console.log(`${pc.dim("Developer:")} ${appDetails.developerName || pc.dim("(not set)")}`);
  if (appDetails.shortDescription) {
    console.log(`${pc.dim("Description:")} ${appDetails.shortDescription}`);
  }
  if (endpoint !== null) {
    console.log(`${pc.dim("Endpoint:")} ${endpoint || pc.yellow("(not set)")}`);
  }

  return { appDetails, endpoint };
}

/**
 * Read-only detail view: prints app info with manage hint.
 * When interactive, shows a "Back" prompt before returning.
 */
export async function showAppDetail(appSummary: AppSummary, token: string, options?: { interactive?: boolean }): Promise<void> {
  const { appDetails } = await printAppHeader(appSummary, token);
  console.log(pc.dim(`\nTip: ${pc.cyan(`teams app view ${appDetails.teamsAppId}`)} to view this app`));

  if (options?.interactive) {
    await select({
      message: "",
      choices: [{ name: "Back", value: "back" }],
    });
  }
}

/**
 * Interactive app menu: shows detail header + action menu (Edit, Package, Secret, Back).
 * Returns when user selects "Back".
 */
export async function showAppMenu(appSummary: AppSummary, token: string): Promise<void> {
  let { appDetails } = await printAppHeader(appSummary, token);
  const { showEditMenu } = await import("../commands/app/edit.js");

  while (true) {
    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "Edit", value: "edit" },
        { name: "Download package", value: "package" },
        { name: "Download manifest", value: "manifest-download" },
        { name: "Upload manifest", value: "manifest-upload" },
        { name: "Generate secret", value: "secret" },
        { name: "Back", value: "back" },
      ],
    });

    if (action === "back") return;

    if (action === "edit") {
      await showEditMenu(appSummary, token);
      // Re-print header after edits
      ({ appDetails } = await printAppHeader(appSummary, token));
      continue;
    }

    if (action === "package") {
      const defaultName = `${(appDetails.shortName || "app").replace(/\s+/g, "-")}.zip`;
      const savePath = await input({
        message: "Save to:",
        default: defaultName,
      });

      const dlSpinner = createSpinner("Downloading package...").start();
      const packageBuffer = await downloadAppPackage(token, appDetails.appId);
      dlSpinner.stop();
      await writeFile(savePath, packageBuffer);
      console.log(pc.green(`Package saved to ${savePath}`));
      continue;
    }

    if (action === "manifest-download") {
      const savePath = await input({
        message: "Save to (leave empty to print):",
        default: "",
      });

      try {
        const { downloadManifest } = await import("../commands/app/manifest/actions.js");
        await downloadManifest(token, appDetails.appId, savePath || undefined);
      } catch (error) {
        console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      }
      continue;
    }

    if (action === "manifest-upload") {
      const filePath = await input({
        message: "Path to manifest.json:",
        default: "manifest.json",
      });

      try {
        const { uploadManifestFromFile } = await import("../commands/app/manifest/actions.js");
        const result = await uploadManifestFromFile(token, appDetails.teamsAppId, filePath);
        appDetails = { ...appDetails, ...result };
      } catch (error) {
        console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      }
      continue;
    }

    if (action === "secret") {
      const { generateSecret } = await import("../commands/app/auth/secret/generate.js");
      try {
        await generateSecret({ tdpToken: token, appId: appDetails.teamsAppId, interactive: true });
      } catch (error) {
        console.log(pc.red(error instanceof Error ? error.message : "Failed to generate secret"));
      }
      continue;
    }
  }
}

