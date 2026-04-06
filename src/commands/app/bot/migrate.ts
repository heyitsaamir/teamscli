import { Command } from "commander";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { fetchBot, deleteBot, registerBot, getBotLocation, createAzureBotHandler, fetchMeetingSubscription, setMeetingSubscription } from "../../../apps/index.js";
import { fetchAppDetailsV2 } from "../../../apps/api.js";
import { pickApp } from "../../../utils/app-picker.js";
import { ensureAz, runAz } from "../../../utils/az.js";
import { resolveSubscription, resolveResourceGroup } from "../../../utils/az-prompts.js";
import { logger } from "../../../utils/logger.js";

interface MigrateOptions {
  subscription?: string;
  resourceGroup?: string;
  createResourceGroup?: boolean;
  region?: string;
}

export const botMigrateCommand = new Command("migrate")
  .description("Migrate bot from BF tenant to Azure")
  .argument("[appId]", "App ID")
  .option("--subscription <id>", "[OPTIONAL] Azure subscription ID")
  .option("--resource-group <name>", "Azure resource group (required)")
  .option("--create-resource-group", "[OPTIONAL] Create the resource group if it doesn't exist")
  .option("--region <name>", "[OPTIONAL] Azure region for resource group (default: westus2)")
  .action(async (appIdArg: string | undefined, options: MigrateOptions) => {
    const account = await getAccount();
    if (!account) {
      console.log(pc.red("Not logged in.") + ` Run ${pc.cyan("teams login")} first.`);
      process.exit(1);
    }

    let token: string;
    let appId: string;

    if (appIdArg) {
      token = (await getTokenSilent(teamsDevPortalScopes))!;
      if (!token) {
        console.log(pc.red("Failed to get token.") + ` Try ${pc.cyan("teams login")} again.`);
        process.exit(1);
      }
      appId = appIdArg;
    } else {
      const picked = await pickApp();
      token = picked.token;
      appId = picked.app.teamsAppId;
    }

    // Get bot details
    const details = await fetchAppDetailsV2(token, appId);
    if (!details.bots || details.bots.length === 0) {
      console.log(pc.red("This app has no bots."));
      process.exit(1);
    }

    const botId = details.bots[0].botId;

    // Check current location
    const spinner = createSpinner("Checking bot location...").start();
    const location = await getBotLocation(token, botId);
    spinner.stop();

    if (location === "azure") {
      console.log(pc.yellow("This bot is already in Azure. No migration needed."));
      return;
    }

    console.log(`${pc.dim("Bot ID:")} ${botId}`);
    console.log(`${pc.dim("Current location:")} BF tenant`);
    console.log();

    // Azure setup
    ensureAz();
    const subscription = await resolveSubscription(options.subscription);
    const resourceGroup = await resolveResourceGroup(subscription, options.resourceGroup);

    if (options.createResourceGroup) {
      const rgRegion = options.region ?? "westus2";
      const rgSpinner = createSpinner(`Creating resource group ${resourceGroup}...`).start();
      runAz(["group", "create", "--name", resourceGroup, "--location", rgRegion, "--subscription", subscription]);
      rgSpinner.success({ text: `Resource group ${resourceGroup} ready` });
    }

    // Get current bot details to preserve for Azure creation and potential rollback
    const detailSpinner = createSpinner("Fetching bot details...").start();
    const botDetails = await fetchBot(token, botId);
    const meetingSub = await fetchMeetingSubscription(token, botId);
    detailSpinner.stop();
    const botName = botDetails.name || details.shortName || "Bot";
    const botEndpoint = botDetails.messagingEndpoint || "";

    if (meetingSub) {
      logger.debug(`Meeting subscriptions: ${meetingSub.eventTypes.join(", ")}`);
    }

    // Warn about features that can't be automatically migrated to Azure
    if (botDetails.configuredChannels.includes("m365extensions")) {
      console.log(pc.yellow("\nWarning: This bot has the M365 Extensions channel enabled."));
      console.log(pc.yellow("This channel cannot be automatically enabled in Azure."));
      console.log(`Re-enable it manually in the Azure portal after migration.\n`);
    }
    if (botDetails.callingEndpoint) {
      console.log(pc.yellow("\nWarning: This bot has a calling endpoint configured."));
      console.log(`${pc.dim("Calling endpoint:")} ${botDetails.callingEndpoint}`);
      console.log(`Re-configure calling in Azure portal > Bot Service > Channels > Teams > Calling.\n`);
    }

    // Set up Azure context
    const azureContext = {
      subscription,
      resourceGroup,
      region: "global",
      tenantId: account.tenantId,
    };
    const handler = createAzureBotHandler(azureContext);
    const createOpts = { botId, name: botName, endpoint: botEndpoint || undefined, description: botDetails.description };

    // Step 1: Validate Azure deployment with what-if (no resources created)
    const validateSpinner = createSpinner("Validating Azure deployment...").start();
    try {
      await handler.validateCreateBot(createOpts);
      validateSpinner.success({ text: "Azure deployment validated" });
    } catch (error) {
      validateSpinner.error({ text: "Azure deployment validation failed" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      console.log(pc.dim("No changes were made. Your bot is still in BF tenant."));
      process.exit(1);
    }

    // Step 2: Delete BF registration (validated that Azure will succeed)
    const deleteSpinner = createSpinner("Removing BF tenant registration...").start();
    try {
      await deleteBot(token, botId);
      deleteSpinner.success({ text: "BF registration removed" });
    } catch (error) {
      deleteSpinner.error({ text: "Failed to remove BF registration" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }

    // Step 3: Create Azure bot (already validated)
    const createSpinnerInst = createSpinner("Creating Azure bot...").start();
    try {
      await handler.createBot(createOpts);
      createSpinnerInst.success({ text: "Azure bot created" });
    } catch (error) {
      createSpinnerInst.error({ text: "Failed to create Azure bot" });
      logger.error(error instanceof Error ? error.message : "Unknown error");

      // Rollback: re-register bot in BF with all original details
      const rollbackSpinner = createSpinner("Rolling back — restoring BF registration...").start();
      try {
        await registerBot(token, {
          botId: botDetails.botId,
          name: botDetails.name,
          endpoint: botDetails.messagingEndpoint,
          description: botDetails.description,
          callingEndpoint: botDetails.callingEndpoint ?? undefined,
          configuredChannels: botDetails.configuredChannels,
        });
        // Restore meeting subscriptions if they existed
        if (meetingSub && meetingSub.eventTypes.length > 0) {
          await setMeetingSubscription(token, botId, meetingSub.eventTypes);
        }
        rollbackSpinner.success({ text: "BF registration restored" });
        console.log(pc.yellow("Migration failed but your bot has been restored to BF tenant."));
      } catch {
        rollbackSpinner.error({ text: "Rollback failed" });
        console.log(pc.red("Could not restore BF registration. Re-register manually:"));
        console.log(pc.cyan(`  teams app create --name "${botName}" --bf`));
      }
      process.exit(1);
    }

    console.log(pc.bold(pc.green("\nBot migrated to Azure!")));
    console.log(pc.dim("Your credentials (CLIENT_ID, CLIENT_SECRET, TENANT_ID) are unchanged."));
  });
