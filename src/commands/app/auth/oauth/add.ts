import { Command } from "commander";
import { input, search } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { runAz } from "../../../../utils/az.js";
import { isInteractive } from "../../../../utils/interactive.js";
import { logger } from "../../../../utils/logger.js";
import { requireAzureBot } from "../require-azure.js";

interface OAuthAddOptions {
  provider?: string;
  connectionName?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string;
  parameters?: string;
}

interface ServiceProvider {
  properties: {
    serviceProviderName: string;
    displayName: string;
  };
}

export const oauthAddCommand = new Command("add")
  .description("Add an OAuth connection to an Azure bot")
  .argument("[appId]", "App ID")
  .option("--provider <name>", "Service provider (e.g., Aadv2, GitHub, Google)")
  .option("--connection-name <name>", "OAuth connection name")
  .option("--client-id <id>", "Provider client ID")
  .option("--client-secret <secret>", "Provider client secret")
  .option("--scopes <scopes>", "Provider scopes (space-delimited)")
  .option("--parameters <params>", "[OPTIONAL] Extra provider params (key=value key=value)")
  .action(async (appIdArg: string | undefined, options: OAuthAddOptions) => {
    const { botId, azure } = await requireAzureBot(appIdArg);
    const interactive = isInteractive();

    // Resolve provider
    let provider = options.provider;
    if (!provider) {
      if (!interactive) {
        logger.error("--provider is required in non-interactive mode");
        process.exit(1);
      }
      const providers = runAz<{ value: ServiceProvider[] }>(["bot", "authsetting", "list-providers"]);
      const providerList = providers.value.map((p) => ({
        name: p.properties.displayName,
        value: p.properties.serviceProviderName,
      }));

      provider = await search<string>({
        message: "Select OAuth provider",
        source: (term) => {
          if (!term) return providerList;
          return providerList.filter((p) =>
            p.name.toLowerCase().includes(term.toLowerCase()),
          );
        },
      });
    }

    // Resolve connection name
    let connectionName = options.connectionName;
    if (!connectionName) {
      if (!interactive) {
        logger.error("--connection-name is required in non-interactive mode");
        process.exit(1);
      }
      connectionName = await input({ message: "Connection name:", default: provider!.toLowerCase() });
    }

    // Resolve client ID
    let clientId = options.clientId;
    if (!clientId) {
      if (!interactive) {
        logger.error("--client-id is required in non-interactive mode");
        process.exit(1);
      }
      clientId = await input({ message: "Client ID:" });
    }

    // Resolve client secret
    let clientSecret = options.clientSecret;
    if (!clientSecret) {
      if (!interactive) {
        logger.error("--client-secret is required in non-interactive mode");
        process.exit(1);
      }
      clientSecret = await input({ message: "Client secret:" });
    }

    // Resolve scopes
    let scopes = options.scopes;
    if (!scopes) {
      if (!interactive) {
        logger.error("--scopes is required in non-interactive mode");
        process.exit(1);
      }
      scopes = await input({ message: "Scopes (space-delimited):" });
    }

    // Create the connection
    const spinner = createSpinner("Creating OAuth connection...").start();
    try {
      const args = [
        "bot", "authsetting", "create",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--setting-name", connectionName,
        "--service", provider!,
        "--client-id", clientId,
        "--client-secret", clientSecret,
        "--provider-scope-string", scopes,
        "--subscription", azure.subscription,
      ];

      // Add extra parameters if provided
      const params = options.parameters;
      if (params) {
        args.push("--parameters", ...params.split(" "));
      }

      runAz(args);
      spinner.success({ text: `OAuth connection "${connectionName}" created` });
    } catch (error) {
      spinner.error({ text: "Failed to create OAuth connection" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  });
