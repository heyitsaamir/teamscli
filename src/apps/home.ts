import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import AdmZip from "adm-zip";
import { readFile, writeFile } from "node:fs/promises";
import { createSpinner } from "nanospinner";
import type { AppSummary, AppDetails } from "./types.js";
import { formatDate } from "../utils/date.js";
import { fetchApp, downloadAppPackage, fetchAppDetailsV2, uploadManifest, type TeamsManifest } from "./api.js";
import { fetchBot, updateBot, type BotDetails } from "./tdp.js";
import { showBasicInfoEditor } from "./basic-info.js";
import { fetchOAuthConfigurations, fetchOAuthConfiguration, deleteOAuthConfiguration, createOAuthConfiguration } from "./oauth.js";
import type { OAuthConfiguration } from "./types.js";

export async function showAppHome(appSummary: AppSummary, token: string): Promise<void> {
  const spinner = createSpinner("Fetching details...").start();

  // Fetch full app details using v2 endpoint
  let appDetails: AppDetails;
  try {
    appDetails = await fetchAppDetailsV2(token, appSummary.teamsAppId);
  } catch {
    // Fall back to basic endpoint if v2 fails
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

  // Fetch bot details if app has bots
  let bot: BotDetails | null = null;
  if (appDetails.bots && appDetails.bots.length > 0) {
    try {
      bot = await fetchBot(token, appDetails.bots[0].botId);
    } catch {
      // Bot fetch failed, skip showing endpoint
    }
  }

  spinner.stop();

  while (true) {
    // Display app details
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
    if (bot) {
      console.log(`${pc.dim("Endpoint:")} ${bot.messagingEndpoint || pc.dim("(not set)")}`);
    }

    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "Edit basic info", value: "edit-basic-info" },
        { name: "Edit endpoint", value: "edit-endpoint" },
        { name: "Manifest", value: "manifest" },
        { name: "OAuth", value: "oauth" },
        { name: "Download package", value: "download-package" },
        { name: "Back", value: "back" },
      ],
    });

    if (action === "back") {
      return;
    }

    if (action === "edit-basic-info") {
      appDetails = await showBasicInfoEditor(appDetails, token);
      continue;
    }

    if (action === "edit-endpoint") {
      if (!bot) {
        console.log(pc.red("\nThis app has no bots."));
        continue;
      }

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
      continue;
    }

    if (action === "manifest") {
      // Manifest submenu loop - stay here until user selects Back
      while (true) {
        const manifestAction = await select({
          message: "Manifest:",
          choices: [
            { name: "Download", value: "download" },
            { name: "Upload", value: "upload" },
            { name: "Back", value: "back" },
          ],
        });

        if (manifestAction === "back") {
          break;
        }

        if (manifestAction === "download") {
          const downloadAction = await select({
            message: "Download manifest:",
            choices: [
              { name: "Display to console", value: "display" },
              { name: "Save to file", value: "save" },
              { name: "Back", value: "back" },
            ],
          });

          if (downloadAction === "back") {
            continue;
          }

          let savePath = "";
          if (downloadAction === "save") {
            savePath = await input({
              message: "Enter path to save manifest:",
              default: "manifest.json",
            });
          }

          const dlSpinner = createSpinner("Downloading manifest...").start();
          const packageBuffer = await downloadAppPackage(token, appDetails.appId);
          dlSpinner.stop();
          const zip = new AdmZip(packageBuffer);
          const manifestEntry = zip.getEntry("manifest.json");

          if (!manifestEntry) {
            console.log(pc.red("\nmanifest.json not found in package"));
            continue;
          }

          const manifestContent = manifestEntry.getData().toString("utf-8");
          const manifestJson = JSON.parse(manifestContent);

          if (savePath) {
            await writeFile(savePath, JSON.stringify(manifestJson, null, 2));
            console.log(pc.green(`\nManifest saved to ${savePath}`));
          } else {
            console.log(pc.dim("\n--- manifest.json ---"));
            console.log(JSON.stringify(manifestJson, null, 2));
          }
          continue;
        }

        if (manifestAction === "upload") {
          const filePath = await input({
            message: "Enter path to manifest.json:",
            default: "manifest.json",
          });

          // Read and parse manifest file
          let manifest: TeamsManifest;
          try {
            const content = await readFile(filePath, "utf-8");
            manifest = JSON.parse(content) as TeamsManifest;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              console.log(pc.red(`\nFile not found: ${filePath}`));
            } else if (error instanceof SyntaxError) {
              console.log(pc.red(`\nInvalid JSON in ${filePath}: ${error.message}`));
            } else {
              console.log(pc.red(`\nFailed to read ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`));
            }
            continue;
          }

          // Basic validation
          if (!manifest.name?.short) {
            console.log(pc.red("\nInvalid manifest: missing name.short"));
            continue;
          }
          if (!manifest.version) {
            console.log(pc.red("\nInvalid manifest: missing version"));
            continue;
          }

          const uploadSpinner = createSpinner("Uploading manifest...").start();
          try {
            const result = await uploadManifest(token, appDetails.teamsAppId, manifest);
            uploadSpinner.success({ text: "Manifest uploaded successfully" });
            // Update local appDetails with new values
            appDetails = { ...appDetails, ...result };
          } catch (error) {
            uploadSpinner.error({ text: "Failed to upload manifest" });
            console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
          }
          continue;
        }
      }
      continue;
    }

    if (action === "oauth") {
      await showOAuthMenu(token, appDetails);
      continue;
    }

    if (action === "download-package") {
      const defaultName = `${appDetails.shortName || "app"}.zip`;
      const packageAction = await select({
        message: "Download package:",
        choices: [
          { name: `Save to ${defaultName}`, value: "default" },
          { name: "Save to custom path", value: "custom" },
          { name: "Back", value: "back" },
        ],
      });

      if (packageAction === "back") {
        continue;
      }

      let savePath = defaultName;
      if (packageAction === "custom") {
        savePath = await input({
          message: "Enter path to save package:",
          default: defaultName,
        });
      }

      const dlSpinner = createSpinner("Downloading package...").start();
      const packageBuffer = await downloadAppPackage(token, appDetails.appId);
      dlSpinner.stop();
      await writeFile(savePath, packageBuffer);
      console.log(pc.green(`\nPackage saved to ${savePath}`));
      continue;
    }
  }
}

async function showOAuthMenu(token: string, appDetails: AppDetails): Promise<void> {
  while (true) {
    // Fetch OAuth configurations
    const spinner = createSpinner("Fetching OAuth configurations...").start();
    let configs: OAuthConfiguration[];
    try {
      configs = await fetchOAuthConfigurations(token);
      spinner.stop();
    } catch (error) {
      spinner.error({ text: "Failed to fetch OAuth configurations" });
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      return;
    }

    // Build choices - always include Create option
    const choices = [
      ...configs.map((config) => ({
        name: `${config.description} (${config.clientId})`,
        value: config.oAuthConfigId,
      })),
      { name: "Create new", value: "create" },
      { name: "Back", value: "back" },
    ];

    if (configs.length === 0) {
      console.log(pc.yellow("\nNo OAuth configurations found."));
    }

    const selected = await select({
      message: configs.length > 0 ? `OAuth Configurations (${configs.length}):` : "OAuth:",
      choices,
    });

    if (selected === "back") {
      return;
    }

    if (selected === "create") {
      await createOAuthConfigInteractive(token, appDetails);
      continue;
    }

    // Show details for selected config
    await showOAuthConfigDetails(token, selected);
  }
}

const httpsUrlRegex = /^https:\/\/\S+$/i;

async function createOAuthConfigInteractive(token: string, appDetails: AppDetails): Promise<void> {
  console.log(`\n${pc.bold("Create OAuth Configuration")}`);
  console.log(`${pc.dim("App:")} ${appDetails.shortName} (${appDetails.teamsAppId})\n`);

  try {
    const description = await input({
      message: "Description:",
      validate: (val) => (val.trim().length > 0 && val.length <= 126) || "Required, max 126 characters",
    });

    const clientId = await input({
      message: "Client ID:",
      validate: (val) => (val.trim().length > 0 && val.length <= 126) || "Required, max 126 characters",
    });

    const clientSecret = await input({
      message: "Client Secret:",
      validate: (val) => (val.length >= 10 && val.length <= 2048) || "Required, 10-2048 characters",
    });

    const authorizationEndpoint = await input({
      message: "Authorization endpoint URL:",
      validate: (val) => httpsUrlRegex.test(val) || "Must be a valid HTTPS URL",
    });

    const tokenExchangeEndpoint = await input({
      message: "Token exchange endpoint URL:",
      validate: (val) => httpsUrlRegex.test(val) || "Must be a valid HTTPS URL",
    });

    const tokenRefreshEndpointInput = await input({
      message: "Token refresh endpoint URL (leave empty to skip):",
      validate: (val) => val === "" || httpsUrlRegex.test(val) || "Must be a valid HTTPS URL",
    });
    const tokenRefreshEndpoint = tokenRefreshEndpointInput || undefined;

    const scopesInput = await input({
      message: "Scopes (comma-separated, leave empty to skip):",
    });
    const scopes = scopesInput ? scopesInput.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const targetUrlsInput = await input({
      message: "Target URLs (comma-separated HTTPS URLs, leave empty to skip):",
    });
    const targetUrlsShouldStartWith = targetUrlsInput
      ? targetUrlsInput.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const targetAudience = await select({
      message: "Target audience:",
      choices: [
        { name: "Home Tenant", value: "HomeTenant" as const },
        { name: "Any Tenant", value: "AnyTenant" as const },
      ],
    });

    const isPKCEEnabled = await select({
      message: "Enable PKCE?",
      choices: [
        { name: "No", value: false },
        { name: "Yes", value: true },
      ],
    });

    const tokenExchangeMethodType = await select({
      message: "Token exchange method:",
      choices: [
        { name: "POST Request Body", value: "PostRequestBody" as const },
        { name: "Basic Authorization Header", value: "BasicAuthorizationHeader" as const },
      ],
    });

    const config = {
      description,
      identityProvider: "Custom" as const,
      applicableToApps: "SpecificApp" as const,
      m365AppId: appDetails.teamsAppId,
      targetAudience,
      clientId,
      clientSecret,
      scopes,
      targetUrlsShouldStartWith,
      authorizationEndpoint,
      tokenExchangeEndpoint,
      ...(tokenRefreshEndpoint && { tokenRefreshEndpoint }),
      isPKCEEnabled,
      tokenExchangeMethodType,
    };

    const createSpinnerInstance = createSpinner("Creating OAuth configuration...").start();
    const created = await createOAuthConfiguration(token, config);
    createSpinnerInstance.success({ text: "OAuth configuration created" });

    console.log(`\n${pc.dim("ID:")} ${pc.bold(pc.green(created.oAuthConfigId))}`);
    if (created.resourceIdentifierUri) {
      console.log(`${pc.dim("Resource URI:")} ${created.resourceIdentifierUri}`);
    }
    console.log();
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      console.log(pc.yellow("\nCancelled."));
      return;
    }
    console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
  }
}

async function showOAuthConfigDetails(token: string, configId: string): Promise<void> {
  const spinner = createSpinner("Fetching OAuth configuration...").start();
  let config: OAuthConfiguration;
  try {
    config = await fetchOAuthConfiguration(token, configId);
    spinner.stop();
  } catch (error) {
    spinner.error({ text: "Failed to fetch OAuth configuration" });
    console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
    return;
  }

  while (true) {
    // Display config details
    console.log(`\n${pc.bold(pc.green(config.description))}`);
    console.log(`${pc.dim("ID:")} ${config.oAuthConfigId}`);
    console.log(`${pc.dim("Provider:")} ${config.identityProvider}`);
    console.log(`${pc.dim("Client ID:")} ${config.clientId}`);
    console.log(`${pc.dim("Applicable to:")} ${config.applicableToApps}`);
    if (config.m365AppId) {
      console.log(`${pc.dim("M365 App ID:")} ${config.m365AppId}`);
    }
    console.log(`${pc.dim("Target audience:")} ${config.targetAudience}`);
    console.log(`${pc.dim("Scopes:")} ${config.scopes.join(", ") || "(none)"}`);
    if (config.resourceIdentifierUri) {
      console.log(`${pc.dim("Resource URI:")} ${config.resourceIdentifierUri}`);
    }

    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "Delete", value: "delete" },
        { name: "Back", value: "back" },
      ],
    });

    if (action === "back") {
      return;
    }

    if (action === "delete") {
      const confirmChoice = await select({
        message: `Delete "${config.description}"?`,
        choices: [
          { name: "Yes, delete", value: "yes" },
          { name: "No, cancel", value: "no" },
        ],
      });

      if (confirmChoice === "yes") {
        const deleteSpinner = createSpinner("Deleting OAuth configuration...").start();
        try {
          await deleteOAuthConfiguration(token, configId);
          deleteSpinner.success({ text: "OAuth configuration deleted" });
          return;
        } catch (error) {
          deleteSpinner.error({ text: "Failed to delete OAuth configuration" });
          console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
        }
      } else {
        console.log(pc.yellow("Deletion cancelled."));
      }
    }
  }
}
