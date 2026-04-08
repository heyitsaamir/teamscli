import { Command } from "commander";
import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../auth/index.js";
import { fetchApp, fetchBot, updateBot, updateAppDetails, fetchAppDetailsV2, showBasicInfoEditor, getBotLocation, createTdpBotHandler, createAzureBotHandler, discoverAzureBot, extractDomain } from "../../apps/index.js";
import { ensureAz } from "../../utils/az.js";
import { CliError, wrapAction } from "../../utils/errors.js";
import { outputJson } from "../../utils/json-output.js";
import { logger } from "../../utils/logger.js";
import { pickApp } from "../../utils/app-picker.js";
import { createSilentSpinner } from "../../utils/spinner.js";
import type { AppSummary, AppDetails } from "../../apps/types.js";
import type { BotDetails } from "../../apps/tdp.js";
import type { BotLocation } from "../../apps/bot-location.js";

interface AppEditEndpointOutput {
  teamsAppId: string;
  botId: string;
  updated: {
    endpoint: string;
  };
  validDomains: string[];
}

interface AppEditInfoOutput {
  teamsAppId: string;
  updated: Record<string, unknown>;
}

/**
 * Interactive edit menu for a single app. Returns when user selects "Back".
 */
export async function showEditMenu(app: AppSummary, token: string): Promise<void> {
  const spinner = createSilentSpinner("Fetching details...").start();

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
    if (botLocation === "tm") {
      try {
        bot = await fetchBot(token, botId);
      } catch {
        // Bot fetch failed, skip
      }
    }
  }

  spinner.stop();

  while (true) {
    logger.info(`\n${pc.bold(appDetails.shortName || "Unnamed")}`);
    logger.info(`${pc.dim("ID:")} ${appDetails.teamsAppId}`);
    if (bot) {
      logger.info(`${pc.dim("Endpoint:")} ${bot.messagingEndpoint || pc.yellow("(not set)")}`);
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
          logger.info(pc.dim("\nNo changes made."));
          continue;
        }

        await ensureAz();
        const azContext = await discoverAzureBot(botId);
        if (!azContext) {
          logger.error(pc.red("Could not find this bot in Azure."));
          continue;
        }
        const handler = createAzureBotHandler(azContext);
        const updateSpinner = createSilentSpinner("Updating endpoint (Azure)...").start();
        await handler.updateEndpoint(botId, newEndpoint.trim());
        updateSpinner.success({ text: "Endpoint updated successfully" });

        // Update validDomains
        const domain = extractDomain(newEndpoint.trim());
        if (domain) {
          const domains = (appDetails.validDomains as string[]) ?? [];
          if (!domains.includes(domain)) {
            const domainSpinner = createSilentSpinner("Updating valid domains...").start();
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
          logger.info(pc.dim("\nNo changes made."));
          continue;
        }

        const updateSpinner = createSilentSpinner("Updating endpoint...").start();
        await updateBot(token, { ...bot, messagingEndpoint: newEndpoint.trim() });
        updateSpinner.success({ text: "Endpoint updated successfully" });
        bot = { ...bot, messagingEndpoint: newEndpoint.trim() };

        // Update validDomains with the new endpoint's domain
        const domain = extractDomain(newEndpoint.trim());
        if (domain) {
          const domains = (appDetails.validDomains as string[]) ?? [];
          if (!domains.includes(domain)) {
            const domainSpinner = createSilentSpinner("Updating valid domains...").start();
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
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(wrapAction(async (appIdArg: string | undefined, options) => {
    const silent = !!options.json;

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

    // --json requires mutation flags
    if (options.json && !hasMutationFlags) {
      throw new CliError("VALIDATION_MISSING", "--json requires at least one mutation flag (--name, --endpoint, etc.).");
    }

    // Interactive mode (no appId, no mutation flags): picker loop
    if (!appIdArg && !hasMutationFlags) {
      while (true) {
        const picked = await pickApp();
        const app = await fetchApp(picked.token, picked.app.teamsAppId);
        await showEditMenu(app, picked.token);
      }
    }

    // Resolve app ID + token
    let appId: string;
    let token: string;

    if (appIdArg) {
      const account = await getAccount();
      if (!account) {
        throw new CliError("AUTH_REQUIRED", "Not logged in.", "Run `teams login` first.");
      }

      token = (await getTokenSilent(teamsDevPortalScopes))!;
      if (!token) {
        throw new CliError("AUTH_TOKEN_FAILED", "Failed to get token.", "Try `teams login` again.");
      }
      appId = appIdArg;
    } else {
      const picked = await pickApp();
      appId = picked.app.teamsAppId;
      token = picked.token;
    }

    const app = await fetchApp(token, appId);

    // Interactive mode with --id: single edit session, "Back" exits
    if (!hasMutationFlags) {
      await showEditMenu(app, token);
      return;
    }

    // Scripting mode: mutation flags provided
    if (options.endpoint) {
      if (!app.bots || app.bots.length === 0) {
        throw new CliError("NOT_FOUND_BOT", "This app has no bots.");
      }

      const botId = app.bots[0].botId;
      const location = await getBotLocation(token, botId);

      if (location === "azure") {
        await ensureAz();
        const azContext = await discoverAzureBot(botId, silent);
        if (!azContext) {
          throw new CliError("NOT_FOUND_AZURE_BOT", "Could not find this bot in Azure.", "Use `az bot update --name <name> --resource-group <rg> --endpoint <url>`");
        }
        const handler = createAzureBotHandler(azContext);
        const updateSpinner = createSilentSpinner("Updating endpoint (Azure)...", silent).start();
        await handler.updateEndpoint(botId, options.endpoint);
        updateSpinner.success({ text: "Endpoint updated successfully" });
        if (!options.json) {
          logger.info(`${pc.dim("New endpoint:")} ${options.endpoint}`);
        }
      } else {
        const spinner = createSilentSpinner("Fetching bot details...", silent).start();
        const bot = await fetchBot(token, botId);
        spinner.stop();

        if (!options.json) {
          logger.info(`${pc.dim("Current endpoint:")} ${bot.messagingEndpoint || pc.dim("(not set)")}`);
        }

        const updateSpinner = createSilentSpinner("Updating endpoint...", silent).start();
        await updateBot(token, { ...bot, messagingEndpoint: options.endpoint });
        updateSpinner.success({ text: "Endpoint updated successfully" });
        if (!options.json) {
          logger.info(`${pc.dim("New endpoint:")} ${options.endpoint}`);
        }
      }

      // Update validDomains with the new endpoint's domain
      const details = await fetchAppDetailsV2(token, appId);
      const domains = (details.validDomains as string[]) ?? [];
      const domain = extractDomain(options.endpoint);
      let validDomains = domains;
      if (domain && !domains.includes(domain)) {
        const domainSpinner = createSilentSpinner("Updating valid domains...", silent).start();
        validDomains = [...domains, domain];
        await updateAppDetails(token, appId, { validDomains });
        domainSpinner.success({ text: `Added ${domain} to valid domains` });
      }

      if (options.json) {
        const result: AppEditEndpointOutput = {
          teamsAppId: appId,
          botId: app.bots[0].botId,
          updated: { endpoint: options.endpoint },
          validDomains,
        };
        outputJson(result);
      }
      return;
    }

    // Handle basic info field updates
    const basicInfoUpdates: Record<string, unknown> = {};

    if (options.name !== undefined) {
      if (options.name.length > 30) {
        throw new CliError("VALIDATION_FORMAT", "Short name must be 30 characters or less.");
      }
      basicInfoUpdates.shortName = options.name;
    }

    if (options.longName !== undefined) {
      if (options.longName.length > 100) {
        throw new CliError("VALIDATION_FORMAT", "Long name must be 100 characters or less.");
      }
      basicInfoUpdates.longName = options.longName;
    }

    if (options.shortDescription !== undefined) {
      if (options.shortDescription.length > 80) {
        throw new CliError("VALIDATION_FORMAT", "Short description must be 80 characters or less.");
      }
      basicInfoUpdates.shortDescription = options.shortDescription;
    }

    if (options.longDescription !== undefined) {
      if (options.longDescription.length > 4000) {
        throw new CliError("VALIDATION_FORMAT", "Long description must be 4000 characters or less.");
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
        throw new CliError("VALIDATION_FORMAT", "Website URL must start with https:// and include a domain.");
      }
      basicInfoUpdates.websiteUrl = options.website;
    }

    if (options.privacyUrl !== undefined) {
      if (!httpsUrlRegex.test(options.privacyUrl)) {
        throw new CliError("VALIDATION_FORMAT", "Privacy URL must start with https:// and include a domain.");
      }
      basicInfoUpdates.privacyUrl = options.privacyUrl;
    }

    if (options.termsUrl !== undefined) {
      if (!httpsUrlRegex.test(options.termsUrl)) {
        throw new CliError("VALIDATION_FORMAT", "Terms of use URL must start with https:// and include a domain.");
      }
      basicInfoUpdates.termsOfUseUrl = options.termsUrl;
    }

    if (Object.keys(basicInfoUpdates).length > 0) {
      const spinner = createSilentSpinner("Updating app details...", silent).start();
      await updateAppDetails(token, appId, basicInfoUpdates);
      spinner.success({ text: "App details updated successfully" });

      if (options.json) {
        const result: AppEditInfoOutput = {
          teamsAppId: appId,
          updated: basicInfoUpdates,
        };
        outputJson(result);
      } else {
        for (const [key, value] of Object.entries(basicInfoUpdates)) {
          const label = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
          logger.info(`${pc.dim(label + ":")} ${value}`);
        }
      }
    }
  }));
