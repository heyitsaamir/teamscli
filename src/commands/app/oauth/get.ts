import { Command } from "commander";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { fetchOAuthConfiguration } from "../../../apps/index.js";
import { formatDate } from "../../../utils/date.js";
import type { OAuthConfigurationCustom } from "../../../apps/types.js";

export const oauthGetCommand = new Command("get")
  .description("Get details of an OAuth configuration")
  .argument("<config-id>", "OAuth configuration ID")
  .option("--json", "[OPTIONAL] Output as JSON")
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

    const spinner = createSpinner("Fetching OAuth configuration...").start();

    try {
      const config = await fetchOAuthConfiguration(token, configId);
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      console.log();
      console.log(pc.bold(pc.green(config.description)));
      console.log();
      console.log(`${pc.dim("ID:")} ${config.oAuthConfigId}`);
      console.log(`${pc.dim("Provider:")} ${config.identityProvider}`);
      console.log(`${pc.dim("Client ID:")} ${config.clientId}`);
      console.log(`${pc.dim("Applicable to:")} ${config.applicableToApps}`);
      if (config.m365AppId) {
        console.log(`${pc.dim("M365 App ID:")} ${config.m365AppId}`);
      }
      console.log(`${pc.dim("Target audience:")} ${config.targetAudience}`);
      if (config.tenantId) {
        console.log(`${pc.dim("Tenant ID:")} ${config.tenantId}`);
      }
      console.log(`${pc.dim("Scopes:")} ${config.scopes.join(", ") || "(none)"}`);
      console.log(`${pc.dim("Target URLs:")} ${config.targetUrlsShouldStartWith.join(", ") || "(none)"}`);

      if (config.identityProvider === "Custom") {
        const customConfig = config as OAuthConfigurationCustom;
        console.log(`${pc.dim("Authorization endpoint:")} ${customConfig.authorizationEndpoint}`);
        console.log(`${pc.dim("Token exchange endpoint:")} ${customConfig.tokenExchangeEndpoint}`);
        if (customConfig.tokenRefreshEndpoint) {
          console.log(`${pc.dim("Token refresh endpoint:")} ${customConfig.tokenRefreshEndpoint}`);
        }
        console.log(`${pc.dim("PKCE enabled:")} ${customConfig.isPKCEEnabled ? "Yes" : "No"}`);
        if (customConfig.tokenExchangeMethodType) {
          console.log(`${pc.dim("Token exchange method:")} ${customConfig.tokenExchangeMethodType}`);
        }
      }

      if (config.resourceIdentifierUri) {
        console.log(`${pc.dim("Resource identifier URI:")} ${config.resourceIdentifierUri}`);
      }
      if (config.createdDateTime) {
        console.log(`${pc.dim("Created:")} ${formatDate(config.createdDateTime)}`);
      }
      console.log();
    } catch (error) {
      spinner.error({ text: "Failed to fetch OAuth configuration" });
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
