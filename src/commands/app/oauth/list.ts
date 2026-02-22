import { Command } from "commander";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { fetchOAuthConfigurations } from "../../../apps/index.js";
import { formatDate } from "../../../utils/date.js";

export const oauthListCommand = new Command("list")
  .description("List OAuth configurations")
  .option("--provider <type>", "[OPTIONAL] Filter by identity provider (Custom or MicrosoftEntra)")
  .action(async (options) => {
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

    const spinner = createSpinner("Fetching OAuth configurations...").start();

    try {
      const configs = await fetchOAuthConfigurations(token, options.provider);
      spinner.stop();

      if (configs.length === 0) {
        console.log(pc.yellow("No OAuth configurations found."));
        return;
      }

      console.log(pc.bold(`\nOAuth Configurations (${configs.length}):\n`));

      for (const config of configs) {
        console.log(`${pc.bold(pc.green(config.description))}`);
        console.log(`  ${pc.dim("ID:")} ${config.oAuthConfigId}`);
        console.log(`  ${pc.dim("Provider:")} ${config.identityProvider}`);
        console.log(`  ${pc.dim("Client ID:")} ${config.clientId}`);
        console.log(`  ${pc.dim("Applicable to:")} ${config.applicableToApps}`);
        if (config.m365AppId) {
          console.log(`  ${pc.dim("App ID:")} ${config.m365AppId}`);
        }
        console.log(`  ${pc.dim("Target audience:")} ${config.targetAudience}`);
        if (config.createdDateTime) {
          console.log(`  ${pc.dim("Created:")} ${formatDate(config.createdDateTime)}`);
        }
        console.log();
      }
    } catch (error) {
      spinner.error({ text: "Failed to fetch OAuth configurations" });
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
