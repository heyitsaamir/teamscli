import { Command } from "commander";
import { input } from "@inquirer/prompts";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import {
  getAccount,
  getTokenSilent,
  graphScopes,
  teamsDevPortalScopes,
} from "../../auth/index.js";
import {
  createAadApp,
  createClientSecret,
  createManifestZip,
  createZipFromManifest,
  importAppPackage,
  readManifestFile,
  readZipFile,
  registerBot,
  updateManifestBotId,
  collectManifestCustomization,
  type ManifestOptions,
} from "../../apps/index.js";
import { logger } from "../../utils/logger.js";
import { writeEnvFile } from "../../utils/env.js";

interface CreateOptions {
  name?: string;
  endpoint?: string;
  manifest?: string;
  package?: string;
  env?: string;
}

export const appCreateCommand = new Command("create")
  .description("Create a new Teams app with bot")
  .option("-n, --name <name>", "App/bot name")
  .option("-e, --endpoint <url>", "Bot messaging endpoint URL")
  .option("-m, --manifest <path>", "Path to manifest.json")
  .option("-p, --package <path>", "Path to app package zip")
  .option("--env <path>", "Path to .env file to write credentials")
  .action(async (options: CreateOptions) => {
    const account = await getAccount();
    if (!account) {
      logger.error(`Not logged in. Run ${pc.cyan("teams login")} first.`);
      process.exit(1);
    }

    // Validate options
    if (options.manifest && options.package) {
      logger.error("Cannot specify both --manifest and --package");
      process.exit(1);
    }

    // ===== Gather all inputs upfront =====

    // Get manifest path (interactive only if no package)
    const manifestPath =
      options.manifest ??
      options.package ??
      ((await input({ message: "Path to manifest.json (leave empty to generate):" })) || undefined);

    // Get name if not using existing package/manifest
    const name =
      options.name ??
      (options.package ? undefined : await input({ message: "App name:" }));

    // Get endpoint
    const endpoint =
      options.endpoint ??
      (await input({ message: "Bot messaging endpoint URL:" }));

    // Get env path
    const envPath =
      options.env ??
      ((await input({ message: "Path to .env file (leave empty to show in terminal):" })) || undefined);

    // If generating manifest, ask for customization options upfront
    const needsGeneratedManifest = !options.package && !manifestPath;
    let descriptionOpts: { short: string; full?: string } | undefined;
    let scopeChoices: string[] | undefined;
    let developerOpts: { name: string; websiteUrl: string; privacyUrl: string; termsOfUseUrl: string } | undefined;

    if (needsGeneratedManifest) {
      const customization = await collectManifestCustomization();
      descriptionOpts = customization.description;
      scopeChoices = customization.scopes;
      developerOpts = customization.developer;
    }

    // ===== All inputs gathered, now do async work =====

    // Get tokens
    let spinner = createSpinner("Acquiring tokens...").start();

    const graphToken = await getTokenSilent(graphScopes);
    if (!graphToken) {
      spinner.error({ text: "Failed to get Graph token" });
      logger.error(`Try ${pc.cyan("teams login")} again.`);
      process.exit(1);
    }

    const tdpToken = await getTokenSilent(teamsDevPortalScopes);
    if (!tdpToken) {
      spinner.error({ text: "Failed to get TDP token" });
      logger.error(`Try ${pc.cyan("teams login")} again.`);
      process.exit(1);
    }
    spinner.success({ text: "Tokens acquired" });

    try {
      let clientId: string;
      let appRegistrationId: string;
      let secretText: string;
      let zipBuffer: Buffer;
      let teamsAppId: string;

      if (options.package) {
        // Use existing package - read manifest to get bot ID
        spinner = createSpinner("Reading package...").start();
        zipBuffer = readZipFile(options.package);
        spinner.success({ text: "Package loaded" });

        // Still need to create AAD app and secret
        spinner = createSpinner("Creating Azure AD app...").start();
        const aadApp = await createAadApp(graphToken, name ?? "Bot");
        clientId = aadApp.appId;
        appRegistrationId = aadApp.id;
        spinner.success({ text: `Created Azure AD app (${clientId})` });
      } else {
        // Create Azure AD app
        spinner = createSpinner("Creating Azure AD app...").start();
        const aadApp = await createAadApp(graphToken, name!);
        clientId = aadApp.appId;
        appRegistrationId = aadApp.id;
        spinner.success({ text: `Created Azure AD app (${clientId})` });

        // Create zip from manifest or generate new one
        if (manifestPath) {
          spinner = createSpinner("Processing manifest...").start();
          const manifest = readManifestFile(manifestPath);
          const updatedManifest = updateManifestBotId(manifest, clientId);
          zipBuffer = createZipFromManifest(updatedManifest);
          spinner.success({ text: "Manifest processed" });
        } else {
          // Generate manifest with pre-collected options
          const manifestOpts: ManifestOptions = {
            botId: clientId,
            botName: name!,
            endpoint,
            description: descriptionOpts,
            scopes: scopeChoices,
            developer: developerOpts,
          };

          zipBuffer = createManifestZip(manifestOpts);
        }
      }

      // Create client secret
      spinner = createSpinner("Generating client secret...").start();
      const secret = await createClientSecret(graphToken, appRegistrationId);
      secretText = secret.secretText;
      spinner.success({ text: "Generated client secret" });

      // Import to Teams
      spinner = createSpinner("Creating Teams app...").start();
      const importedApp = await importAppPackage(tdpToken, zipBuffer);
      teamsAppId = importedApp.teamsAppId;
      spinner.success({ text: `Created Teams app (${teamsAppId})` });

      // Register bot
      spinner = createSpinner("Registering bot...").start();
      await registerBot(tdpToken, {
        botId: clientId,
        name: name ?? "Bot",
        endpoint,
      });
      spinner.success({ text: "Registered bot" });

      // Write to .env if specified
      if (envPath) {
        spinner = createSpinner("Writing .env file...").start();
        writeEnvFile(envPath, {
          BOT_ID: clientId,
          BOT_PASSWORD: secretText,
          TEAMS_APP_ID: teamsAppId,
          BOT_ENDPOINT: endpoint,
        });
        spinner.success({ text: `Credentials written to ${envPath}` });

        logger.info(pc.bold(pc.green("\nApp created successfully!")));
        logger.info(`Credentials written to ${pc.cyan(envPath)}`);
      } else {
        // Show in terminal
        logger.info(pc.bold(pc.green("\nApp created successfully!")));
        logger.info(`\n${pc.dim("Client ID:")} ${clientId}`);
        logger.info(`${pc.dim("Client Secret:")} ${secretText}`);
        logger.info(`${pc.dim("Teams App ID:")} ${teamsAppId}`);
        logger.info(`${pc.dim("Endpoint:")} ${endpoint}`);

        logger.warn("Save the client secret - it won't be shown again!");
      }
    } catch (error) {
      spinner.error({ text: "Failed" });
      logger.error(error instanceof Error ? error.message : "Failed to create app");
      process.exit(1);
    }
  });
