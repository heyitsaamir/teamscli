import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { fetchOAuthConfiguration, deleteOAuthConfiguration } from "../../../apps/index.js";

export const oauthDeleteCommand = new Command("delete")
  .description("Delete an OAuth configuration")
  .argument("<config-id>", "OAuth configuration ID")
  .option("-y, --yes", "[OPTIONAL] Skip confirmation prompt")
  .action(async (configId: string, options) => {
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
      // Fetch config first to show description
      const fetchSpinner = createSpinner("Fetching OAuth configuration...").start();
      const config = await fetchOAuthConfiguration(token, configId);
      fetchSpinner.stop();

      console.log();
      console.log(`${pc.dim("Description:")} ${config.description}`);
      console.log(`${pc.dim("Client ID:")} ${config.clientId}`);
      console.log();

      // Confirm deletion
      if (!options.yes) {
        const confirmed = await confirm({
          message: `Delete OAuth configuration "${config.description}"?`,
          default: false,
        });

        if (!confirmed) {
          console.log(pc.yellow("Deletion cancelled."));
          return;
        }
      }

      const deleteSpinner = createSpinner("Deleting OAuth configuration...").start();
      await deleteOAuthConfiguration(token, configId);
      deleteSpinner.success({ text: "OAuth configuration deleted" });
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        return;
      }
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
