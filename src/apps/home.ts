import { select } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import type { AppSummary, AppDetails } from "./types.js";
import { fetchApp, fetchAppDetailsV2 } from "./api.js";
import { fetchBot } from "./tdp.js";
import { logger } from "../utils/logger.js";

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

  logger.info(`\n${pc.bold(appDetails.shortName || "Unnamed")}`);
  logger.info(`${pc.dim("ID:")} ${appDetails.teamsAppId}`);
  logger.info(`${pc.dim("Version:")} ${appDetails.version ?? "N/A"}`);
  if (appDetails.longName) {
    logger.info(`${pc.dim("Long name:")} ${appDetails.longName}`);
  }
  logger.info(`${pc.dim("Developer:")} ${appDetails.developerName || pc.dim("(not set)")}`);
  if (appDetails.shortDescription) {
    logger.info(`${pc.dim("Description:")} ${appDetails.shortDescription}`);
  }
  if (endpoint !== null) {
    logger.info(`${pc.dim("Endpoint:")} ${endpoint || pc.yellow("(not set)")}`);
  }
  const installLink = `https://teams.microsoft.com/l/app/${appDetails.teamsAppId}?installAppPackage=true`;
  logger.info(`${pc.dim("Install link:")} ${installLink}`);

  return { appDetails, endpoint };
}

/**
 * Read-only detail view: prints app info with manage hint.
 * When interactive, shows a "Back" prompt before returning.
 */
export async function showAppDetail(appSummary: AppSummary, token: string, options?: { interactive?: boolean }): Promise<void> {
  const { appDetails } = await printAppHeader(appSummary, token);
  logger.info(pc.dim(`\nTip: ${pc.cyan(`teams app view ${appDetails.teamsAppId}`)} to view this app`));

  if (options?.interactive) {
    await select({
      message: "",
      choices: [{ name: "Back", value: "back" }],
    });
  }
}

