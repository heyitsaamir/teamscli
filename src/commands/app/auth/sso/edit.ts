import { Command } from "commander";
import { input, select, search } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getTokenSilent, graphScopes } from "../../../../auth/index.js";
import { getAadAppByClientId, createClientSecret } from "../../../../apps/graph.js";
import { runAz } from "../../../../utils/az.js";
import { isInteractive } from "../../../../utils/interactive.js";
import { logger } from "../../../../utils/logger.js";
import { requireAzureBot } from "../require-azure.js";

interface AuthSetting {
  name: string;
  properties?: {
    serviceProviderDisplayName?: string;
    clientId?: string;
    scopes?: string;
    parameters?: Array<{ key: string; value: string }>;
  };
}

export const ssoEditCommand = new Command("edit")
  .description("Edit an SSO connection's settings")
  .argument("[appId]", "App ID")
  .option("--connection-name <name>", "SSO connection to edit")
  .option("--scopes <scopes>", "[OPTIONAL] New scopes")
  .option("--new-connection-name <name>", "[OPTIONAL] Rename the connection")
  .option("--client-secret <secret>", "[OPTIONAL] Client secret (auto-generated if not provided)")
  .action(async (appIdArg: string | undefined, options: {
    connectionName?: string;
    scopes?: string;
    newConnectionName?: string;
    clientSecret?: string;
  }) => {
    const { botId, azure } = await requireAzureBot(appIdArg);
    const interactive = isInteractive();

    // Pick connection to edit
    let connectionName = options.connectionName;
    if (!connectionName) {
      if (!interactive) {
        logger.error("--connection-name is required in non-interactive mode");
        process.exit(1);
      }

      const settings = runAz<AuthSetting[]>([
        "bot", "authsetting", "list",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--subscription", azure.subscription,
      ]);

      const aadConnections = settings.filter((s) => {
        const provider = s.properties?.serviceProviderDisplayName ?? "";
        return provider.includes("Azure Active Directory");
      });

      if (aadConnections.length === 0) {
        console.log(pc.dim("No SSO connections to edit."));
        return;
      }

      const choices = aadConnections.map((s) => {
        const name = s.name.split("/").pop() ?? s.name;
        return { name, value: name };
      });

      connectionName = await search<string>({
        message: "Select SSO connection to edit",
        source: (term) => {
          if (!term) return choices;
          return choices.filter((c) => c.value.toLowerCase().includes(term.toLowerCase()));
        },
      });
    }

    // Fetch current details
    const current = runAz<AuthSetting>([
      "bot", "authsetting", "show",
      "--name", botId,
      "--resource-group", azure.resourceGroup,
      "--setting-name", connectionName,
      "--subscription", azure.subscription,
    ]);

    const currentScopes = current.properties?.scopes ?? "User.Read";
    const currentTenantId = current.properties?.parameters?.find((p) => p.key === "tenantId")?.value ?? azure.tenantId;
    const currentTokenExchangeUrl = current.properties?.parameters?.find((p) => p.key === "tokenExchangeUrl")?.value ?? `api://botid-${botId}`;

    let newScopes = options.scopes ?? currentScopes;
    let newName = options.newConnectionName ?? connectionName;

    // Interactive: field-by-field editor
    if (interactive && !options.scopes && !options.newConnectionName) {
      let changed = false;

      while (true) {
        const field = await select({
          message: `Edit "${connectionName}"`,
          choices: [
            { name: `Scopes: ${pc.bold(newScopes)}`, value: "scopes" },
            { name: `Connection name: ${pc.bold(newName)}`, value: "name" },
            { name: changed ? "Save" : "Back", value: "done" },
          ],
        });

        if (field === "done") {
          if (!changed) return;
          break;
        }

        if (field === "scopes") {
          newScopes = await input({ message: "Scopes:", default: newScopes });
          changed = true;
        } else if (field === "name") {
          newName = await input({ message: "Connection name:", default: newName });
          changed = true;
        }
      }
    }

    // Check if anything changed
    if (newScopes === currentScopes && newName === connectionName) {
      console.log(pc.dim("No changes made."));
      return;
    }

    // Get or create client secret
    let clientSecret = options.clientSecret;
    if (!clientSecret && interactive) {
      clientSecret = await input({
        message: "Client secret (leave empty to create a new one):",
      });
    }

    if (!clientSecret) {
      const graphToken = await getTokenSilent(graphScopes);
      if (!graphToken) {
        console.log(pc.red("Failed to get Graph token.") + ` Try ${pc.cyan("teams login")} again.`);
        process.exit(1);
      }
      const secretSpinner = createSpinner("Creating new client secret...").start();
      const aadApp = await getAadAppByClientId(graphToken, botId);
      const secret = await createClientSecret(graphToken, aadApp.id);
      clientSecret = secret.secretText;
      secretSpinner.success({ text: "Client secret created" });
    }

    // Delete and recreate (az bot authsetting has no update command)
    const spinner = createSpinner("Updating SSO connection...").start();
    try {
      runAz([
        "bot", "authsetting", "delete",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--setting-name", connectionName,
        "--subscription", azure.subscription,
      ]);

      runAz([
        "bot", "authsetting", "create",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--setting-name", newName,
        "--service", "Aadv2",
        "--client-id", botId,
        "--client-secret", clientSecret,
        "--provider-scope-string", newScopes,
        "--parameters",
        `tenantId=${currentTenantId}`,
        `tokenExchangeUrl=${currentTokenExchangeUrl}`,
        "--subscription", azure.subscription,
      ]);

      spinner.success({ text: `SSO connection updated` });
      if (newName !== connectionName) console.log(`${pc.dim("Connection name:")} ${newName}`);
      console.log(`${pc.dim("Scopes:")} ${newScopes}`);
    } catch (error) {
      spinner.error({ text: "Failed to update SSO connection" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  });
