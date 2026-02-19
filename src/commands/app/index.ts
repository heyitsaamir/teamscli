import { Command } from "commander";
import pc from "picocolors";
import { writeFile } from "node:fs/promises";
import { createSpinner } from "nanospinner";
import { appListCommand, runAppList } from "./list.js";
import { appCreateCommand } from "./create.js";
import { manifestCommand } from "./manifest/index.js";
import { appContext } from "./context.js";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../auth/index.js";
import { fetchApp, showAppHome, downloadAppPackage, fetchBot, updateBot, updateAppDetails } from "../../apps/index.js";

export const appCommand = new Command("app")
  .description("Manage Teams apps")
  .option("--id <appId>", "[OPTIONAL] Go directly to app details by ID")
  .option("--download-package <path>", "[OPTIONAL] Download full app package to file")
  .option("--set-endpoint <url>", "[OPTIONAL] Set the bot messaging endpoint URL")
  .option("--set-name <name>", "[OPTIONAL] Set the app short name (max 30 chars)")
  .option("--set-long-name <name>", "[OPTIONAL] Set the app long name (max 100 chars)")
  .option("--set-short-description <desc>", "[OPTIONAL] Set the short description (max 80 chars)")
  .option("--set-long-description <desc>", "[OPTIONAL] Set the long description (max 4000 chars)")
  .option("--set-version <version>", "[OPTIONAL] Set the app version")
  .option("--set-developer <name>", "[OPTIONAL] Set the developer name")
  .option("--set-website <url>", "[OPTIONAL] Set the website URL (HTTPS required)")
  .option("--set-privacy-url <url>", "[OPTIONAL] Set the privacy policy URL (HTTPS required)")
  .option("--set-terms-url <url>", "[OPTIONAL] Set the terms of use URL (HTTPS required)")
  .action(async (options, command) => {
    if (!options.id) {
      command.help();
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

      if (options.downloadPackage) {
        const spinner = createSpinner("Downloading package...").start();
        const packageBuffer = await downloadAppPackage(token, app.appId);
        spinner.stop();
        await writeFile(options.downloadPackage, packageBuffer);
        console.log(pc.green(`Package saved to ${options.downloadPackage}`));
        return;
      }

      if (options.setEndpoint) {
        if (!app.bots || app.bots.length === 0) {
          console.log(pc.red("This app has no bots."));
          process.exit(1);
        }

        const botId = app.bots[0].botId;
        const spinner = createSpinner("Fetching bot details...").start();
        const bot = await fetchBot(token, botId);
        spinner.stop();

        console.log(`${pc.dim("Current endpoint:")} ${bot.messagingEndpoint || pc.dim("(not set)")}`);

        const updateSpinner = createSpinner("Updating endpoint...").start();
        await updateBot(token, { ...bot, messagingEndpoint: options.setEndpoint });
        updateSpinner.success({ text: "Endpoint updated successfully" });
        console.log(`${pc.dim("New endpoint:")} ${options.setEndpoint}`);
        return;
      }

      // Handle basic info field updates
      const basicInfoUpdates: Record<string, unknown> = {};

      if (options.setName !== undefined) {
        if (options.setName.length > 30) {
          console.log(pc.red("Short name must be 30 characters or less."));
          process.exit(1);
        }
        basicInfoUpdates.shortName = options.setName;
      }

      if (options.setLongName !== undefined) {
        if (options.setLongName.length > 100) {
          console.log(pc.red("Long name must be 100 characters or less."));
          process.exit(1);
        }
        basicInfoUpdates.longName = options.setLongName;
      }

      if (options.setShortDescription !== undefined) {
        if (options.setShortDescription.length > 80) {
          console.log(pc.red("Short description must be 80 characters or less."));
          process.exit(1);
        }
        basicInfoUpdates.shortDescription = options.setShortDescription;
      }

      if (options.setLongDescription !== undefined) {
        if (options.setLongDescription.length > 4000) {
          console.log(pc.red("Long description must be 4000 characters or less."));
          process.exit(1);
        }
        basicInfoUpdates.longDescription = options.setLongDescription;
      }

      if (options.setVersion !== undefined) {
        basicInfoUpdates.version = options.setVersion;
      }

      if (options.setDeveloper !== undefined) {
        basicInfoUpdates.developerName = options.setDeveloper;
      }

      const httpsUrlRegex = /^https:\/\/.+/i;

      if (options.setWebsite !== undefined) {
        if (!httpsUrlRegex.test(options.setWebsite)) {
          console.log(pc.red("Website URL must start with https:// and include a domain"));
          process.exit(1);
        }
        basicInfoUpdates.websiteUrl = options.setWebsite;
      }

      if (options.setPrivacyUrl !== undefined) {
        if (!httpsUrlRegex.test(options.setPrivacyUrl)) {
          console.log(pc.red("Privacy URL must start with https:// and include a domain"));
          process.exit(1);
        }
        basicInfoUpdates.privacyUrl = options.setPrivacyUrl;
      }

      if (options.setTermsUrl !== undefined) {
        if (!httpsUrlRegex.test(options.setTermsUrl)) {
          console.log(pc.red("Terms of use URL must start with https:// and include a domain"));
          process.exit(1);
        }
        basicInfoUpdates.termsOfUseUrl = options.setTermsUrl;
      }

      // If any basic info updates were specified, apply them
      if (Object.keys(basicInfoUpdates).length > 0) {
        const spinner = createSpinner("Updating app details...").start();
        try {
          await updateAppDetails(token, options.id, basicInfoUpdates);
          spinner.success({ text: "App details updated successfully" });

          // Show what was updated
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

// Populate context before subcommands run
appCommand.hook("preSubcommand", async (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.id) {
    appContext.appId = opts.id;
  }
});

appCommand.addCommand(appListCommand);
appCommand.addCommand(appCreateCommand);
appCommand.addCommand(manifestCommand);
