import { Command } from "commander";
import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../auth/index.js";
import { fetchApp, fetchBot, updateBot, updateAppDetails, fetchAppDetailsV2, showBasicInfoEditor, getBotLocation, createTdpBotHandler, createAzureBotHandler, discoverAzureBot, extractDomain } from "../../apps/index.js";
import { ensureAz } from "../../utils/az.js";
import { pickApp } from "../../utils/app-picker.js";
import type { AppSummary, AppDetails } from "../../apps/types.js";
import type { BotDetails } from "../../apps/tdp.js";
import type { BotLocation } from "../../apps/bot-location.js";

/**
 * Interactive edit menu for a single app. Returns when user selects "Back".
 */
export async function showEditMenu(app: AppSummary, token: string): Promise<void> {
  const spinner = createSpinner("Fetching details...").start();

  let appDetails: AppDetails;
  try {
    appDetails = await fetchAppDetailsV2(token, app.teamsAppId);
  } catch {
    appDetails = {
      ...app,
      shortName: app.appName ?? "",
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

  let bot: BotDetails | null = null;
  let botLocation: BotLocation | null = null;
  if (appDetails.bots && appDetails.bots.length > 0) {
    const botId = appDetails.bots[0].botId;
    botLocation = await getBotLocation(token, botId);
    if (botLocation === "bf") {
      try {
        bot = await fetchBot(token, botId);
      } catch {
        // Bot fetch failed, skip
      }
    }
  }

  spinner.stop();

  while (true) {
    console.log(`\n${pc.bold(appDetails.shortName || "Unnamed")}`);
    console.log(`${pc.dim("ID:")} ${appDetails.teamsAppId}`);
    if (bot) {
      console.log(`${pc.dim("Endpoint:")} ${bot.messagingEndpoint || pc.yellow("(not set)")}`);
    }
    if (botLocation) {
      console.log(`${pc.dim("Bot location:")} ${botLocation === "bf" ? "BF tenant" : "Azure"}`);
    }

    const showEndpoint = bot || botLocation === "azure";
    const action = await select({
      message: "What would you like to edit?",
      choices: [
        { name: "Basic info", value: "edit-basic-info" },
        ...(showEndpoint ? [{ name: "Endpoint", value: "edit-endpoint" }] : []),
        { name: "Back", value: "back" },
      ],
    });

    if (action === "back") return;

    if (action === "edit-basic-info") {
      appDetails = await showBasicInfoEditor(appDetails, token);
      continue;
    }

    if (action === "edit-endpoint") {
      if (botLocation === "azure") {
        const botId = appDetails.bots![0].botId;
        const newEndpoint = await input({
          message: "Enter new messaging endpoint URL:",
        });

        if (!newEndpoint.trim()) {
          console.log(pc.dim("\nNo changes made."));
          continue;
        }

        ensureAz();
        const azContext = discoverAzureBot(botId);
        if (!azContext) {
          console.log(pc.red("Could not find this bot in Azure."));
          continue;
        }
        const handler = createAzureBotHandler(azContext);
        const updateSpinner = createSpinner("Updating endpoint (Azure)...").start();
        await handler.updateEndpoint(botId, newEndpoint.trim());
        updateSpinner.success({ text: "Endpoint updated successfully" });

        // Update validDomains
        const domain = extractDomain(newEndpoint.trim());
        if (domain) {
          const domains = (appDetails.validDomains as string[]) ?? [];
          if (!domains.includes(domain)) {
            const domainSpinner = createSpinner("Updating valid domains...").start();
            await updateAppDetails(token, app.teamsAppId, { validDomains: [...domains, domain] });
            domainSpinner.success({ text: `Added ${domain} to valid domains` });
          }
        }
        continue;
      }

      if (bot) {
        const newEndpoint = await input({
          message: "Enter new messaging endpoint URL:",
          default: bot.messagingEndpoint,
        });

        if (newEndpoint.trim() === bot.messagingEndpoint) {
          console.log(pc.dim("\nNo changes made."));
          continue;
        }

        const updateSpinner = createSpinner("Updating endpoint...").start();
        await updateBot(token, { ...bot, messagingEndpoint: newEndpoint.trim() });
        updateSpinner.success({ text: "Endpoint updated successfully" });
        bot = { ...bot, messagingEndpoint: newEndpoint.trim() };

        // Update validDomains with the new endpoint's domain
        const domain = extractDomain(newEndpoint.trim());
        if (domain) {
          const domains = (appDetails.validDomains as string[]) ?? [];
          if (!domains.includes(domain)) {
            const domainSpinner = createSpinner("Updating valid domains...").start();
            await updateAppDetails(token, app.teamsAppId, { validDomains: [...domains, domain] });
            domainSpinner.success({ text: `Added ${domain} to valid domains` });
          }
        }
        continue;
      }
    }
  }
}

export const appEditCommand = new Command("edit")
  .description("Edit a Teams app's properties")
  .argument("[appId]", "App ID")
  .option("--endpoint <url>", "[OPTIONAL] Set the bot messaging endpoint URL")
  .option("--name <name>", "[OPTIONAL] Set the app short name (max 30 chars)")
  .option("--long-name <name>", "[OPTIONAL] Set the app long name (max 100 chars)")
  .option("--short-description <desc>", "[OPTIONAL] Set the short description (max 80 chars)")
  .option("--long-description <desc>", "[OPTIONAL] Set the long description (max 4000 chars)")
  .option("--version <version>", "[OPTIONAL] Set the app version")
  .option("--developer <name>", "[OPTIONAL] Set the developer name")
  .option("--website <url>", "[OPTIONAL] Set the website URL (HTTPS required)")
  .option("--privacy-url <url>", "[OPTIONAL] Set the privacy policy URL (HTTPS required)")
  .option("--terms-url <url>", "[OPTIONAL] Set the terms of use URL (HTTPS required)")
  .action(async (appIdArg: string | undefined, options) => {
    // Check if any mutation flags were provided
    const hasMutationFlags = options.endpoint !== undefined
      || options.name !== undefined
      || options.longName !== undefined
      || options.shortDescription !== undefined
      || options.longDescription !== undefined
      || options.version !== undefined
      || options.developer !== undefined
      || options.website !== undefined
      || options.privacyUrl !== undefined
      || options.termsUrl !== undefined;

    // Interactive mode (no appId, no mutation flags): picker loop
    if (!appIdArg && !hasMutationFlags) {
      while (true) {
        try {
          const picked = await pickApp();
          const app = await fetchApp(picked.token, picked.app.teamsAppId);
          await showEditMenu(app, picked.token);
        } catch (error) {
          if (error instanceof Error && error.name === "ExitPromptError") {
            return;
          }
          throw error;
        }
      }
    }

    // Resolve app ID + token (--id provided, or picker for scripting with flags)
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

      // Interactive mode with --id: single edit session, "Back" exits
      if (!hasMutationFlags) {
        try {
          await showEditMenu(app, token);
        } catch (error) {
          if (error instanceof Error && error.name === "ExitPromptError") {
            return;
          }
          throw error;
        }
        return;
      }

      // Scripting mode: mutation flags provided
      if (options.endpoint) {
        if (!app.bots || app.bots.length === 0) {
          console.log(pc.red("This app has no bots."));
          process.exit(1);
        }

        const botId = app.bots[0].botId;
        const location = await getBotLocation(token, botId);

        if (location === "azure") {
          ensureAz();
          const azContext = discoverAzureBot(botId);
          if (!azContext) {
            console.log(pc.red("Could not find this bot in Azure."));
            console.log(`Use: ${pc.cyan("az bot update --name <name> --resource-group <rg> --endpoint <url>")}`);
            process.exit(1);
          }
          const handler = createAzureBotHandler(azContext);
          const updateSpinner = createSpinner("Updating endpoint (Azure)...").start();
          await handler.updateEndpoint(botId, options.endpoint);
          updateSpinner.success({ text: "Endpoint updated successfully" });
          console.log(`${pc.dim("New endpoint:")} ${options.endpoint}`);
        } else {
          const spinner = createSpinner("Fetching bot details...").start();
          const bot = await fetchBot(token, botId);
          spinner.stop();

          console.log(`${pc.dim("Current endpoint:")} ${bot.messagingEndpoint || pc.dim("(not set)")}`);

          const updateSpinner = createSpinner("Updating endpoint...").start();
          await updateBot(token, { ...bot, messagingEndpoint: options.endpoint });
          updateSpinner.success({ text: "Endpoint updated successfully" });
          console.log(`${pc.dim("New endpoint:")} ${options.endpoint}`);
        }

        // Update validDomains with the new endpoint's domain
        const domain = extractDomain(options.endpoint);
        if (domain) {
          const details = await fetchAppDetailsV2(token, appId);
          const domains = (details.validDomains as string[]) ?? [];
          if (!domains.includes(domain)) {
            const domainSpinner = createSpinner("Updating valid domains...").start();
            await updateAppDetails(token, appId, { validDomains: [...domains, domain] });
            domainSpinner.success({ text: `Added ${domain} to valid domains` });
          }
        }
        return;
      }

      // Handle basic info field updates
      const basicInfoUpdates: Record<string, unknown> = {};

      if (options.name !== undefined) {
        if (options.name.length > 30) {
          console.log(pc.red("Short name must be 30 characters or less."));
          process.exit(1);
        }
        basicInfoUpdates.shortName = options.name;
      }

      if (options.longName !== undefined) {
        if (options.longName.length > 100) {
          console.log(pc.red("Long name must be 100 characters or less."));
          process.exit(1);
        }
        basicInfoUpdates.longName = options.longName;
      }

      if (options.shortDescription !== undefined) {
        if (options.shortDescription.length > 80) {
          console.log(pc.red("Short description must be 80 characters or less."));
          process.exit(1);
        }
        basicInfoUpdates.shortDescription = options.shortDescription;
      }

      if (options.longDescription !== undefined) {
        if (options.longDescription.length > 4000) {
          console.log(pc.red("Long description must be 4000 characters or less."));
          process.exit(1);
        }
        basicInfoUpdates.longDescription = options.longDescription;
      }

      if (options.version !== undefined) {
        basicInfoUpdates.version = options.version;
      }

      if (options.developer !== undefined) {
        basicInfoUpdates.developerName = options.developer;
      }

      const httpsUrlRegex = /^https:\/\/\S+$/i;

      if (options.website !== undefined) {
        if (!httpsUrlRegex.test(options.website)) {
          console.log(pc.red("Website URL must start with https:// and include a domain"));
          process.exit(1);
        }
        basicInfoUpdates.websiteUrl = options.website;
      }

      if (options.privacyUrl !== undefined) {
        if (!httpsUrlRegex.test(options.privacyUrl)) {
          console.log(pc.red("Privacy URL must start with https:// and include a domain"));
          process.exit(1);
        }
        basicInfoUpdates.privacyUrl = options.privacyUrl;
      }

      if (options.termsUrl !== undefined) {
        if (!httpsUrlRegex.test(options.termsUrl)) {
          console.log(pc.red("Terms of use URL must start with https:// and include a domain"));
          process.exit(1);
        }
        basicInfoUpdates.termsOfUseUrl = options.termsUrl;
      }

      if (Object.keys(basicInfoUpdates).length > 0) {
        const spinner = createSpinner("Updating app details...").start();
        try {
          await updateAppDetails(token, appId, basicInfoUpdates);
          spinner.success({ text: "App details updated successfully" });

          for (const [key, value] of Object.entries(basicInfoUpdates)) {
            const label = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
            console.log(`${pc.dim(label + ":")} ${value}`);
          }
        } catch (error) {
          spinner.error({ text: "Failed to update app details" });
          throw error;
        }
        return;
      }
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
