import { Command } from "commander";
import { input } from "@inquirer/prompts";
import pc from "picocolors";
import { getTokenSilent, graphScopes } from "../../../../auth/index.js";
import { getAadAppByClientId, getAadAppFull, updateAadApp, createClientSecret } from "../../../../apps/graph.js";
import { updateAppDetails, fetchAppDetailsV2 } from "../../../../apps/api.js";
import { runAz } from "../../../../utils/az.js";
import { isInteractive } from "../../../../utils/interactive.js";
import { outputJson } from "../../../../utils/json-output.js";
import { logger } from "../../../../utils/logger.js";
import { createSilentSpinner } from "../../../../utils/spinner.js";
import { requireAzureBot } from "../require-azure.js";

// Teams client IDs to pre-authorize for SSO
const TEAMS_DESKTOP_CLIENT = "1fec8e78-bce4-4aaf-ab1b-5451cc387264";
const TEAMS_WEB_CLIENT = "5e3ce6c0-2b1f-4285-8d4b-75ee78787346";

interface SsoSetupOutput {
  botId: string;
  connectionName: string;
  identifierUri: string;
  scopes: string;
  clientSecretCreated: boolean;
  manifestUpdated: boolean;
}

interface SsoOptions {
  connectionName?: string;
  scopes?: string;
  clientSecret?: string;
  json?: boolean;
}

interface OAuth2Scope {
  id: string;
  adminConsentDescription: string;
  adminConsentDisplayName: string;
  isEnabled: boolean;
  type: string;
  value: string;
}

export const ssoSetupCommand = new Command("setup")
  .description("Set up SSO for an Azure bot (configures AAD app + OAuth connection + manifest)")
  .argument("[appId]", "App ID")
  .option("--connection-name <name>", "[OPTIONAL] OAuth connection name (default: sso)")
  .option("--scopes <scopes>", "[OPTIONAL] Scopes (default: User.Read)")
  .option("--client-secret <secret>", "AAD app client secret")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(async (appIdArg: string | undefined, options: SsoOptions) => {
    const silent = !!options.json;
    const { token, appId, botId, azure } = await requireAzureBot(appIdArg, silent);
    const interactive = isInteractive();

    let connectionName = options.connectionName;
    if (!connectionName && interactive && !options.json) {
      connectionName = await input({ message: "Connection name:", default: "sso" });
    }
    connectionName = connectionName ?? "sso";

    let scopes = options.scopes;
    if (!scopes && interactive && !options.json) {
      scopes = await input({ message: "Scopes:", default: "User.Read" });
    }
    scopes = scopes ?? "User.Read";

    // Get Graph token (needed for both secret creation and AAD app updates)
    const graphToken = await getTokenSilent(graphScopes);
    if (!graphToken) {
      console.log(pc.red("Failed to get Graph token.") + ` Try ${pc.cyan("teams login")} again.`);
      process.exit(1);
    }

    // Client secret — use provided, prompt, or create new
    let clientSecret = options.clientSecret;
    let clientSecretCreated = false;
    if (!clientSecret) {
      if (!interactive || options.json) {
        // In non-interactive or JSON mode, auto-create a secret
        const secretSpinner = createSilentSpinner("Creating new client secret...", silent).start();
        const aadApp = await getAadAppByClientId(graphToken, botId);
        const secret = await createClientSecret(graphToken, aadApp.id);
        clientSecret = secret.secretText;
        clientSecretCreated = true;
        secretSpinner.success({ text: "Client secret created" });
      } else {
        clientSecret = await input({
          message: "AAD app client secret (leave empty to create a new one):",
        });

        if (!clientSecret) {
          const secretSpinner = createSilentSpinner("Creating new client secret...", silent).start();
          const aadApp = await getAadAppByClientId(graphToken, botId);
          const secret = await createClientSecret(graphToken, aadApp.id);
          clientSecret = secret.secretText;
          clientSecretCreated = true;
          secretSpinner.success({ text: "Client secret created" });
        }
      }
    }

    // Step 1: Update AAD app registration
    const aadSpinner = createSilentSpinner("Configuring AAD app for SSO...", silent).start();
    try {
      // Look up Graph object ID
      const aadApp = await getAadAppByClientId(graphToken, botId);
      const fullApp = await getAadAppFull(graphToken, aadApp.id);

      const identifierUri = `api://botid-${botId}`;

      // Build the access_as_user scope
      const existingScopes = (fullApp.api as Record<string, unknown>)?.oauth2PermissionScopes as OAuth2Scope[] ?? [];
      const hasAccessAsUser = existingScopes.some((s) => s.value === "access_as_user");

      const accessAsUserScope: OAuth2Scope = {
        id: crypto.randomUUID(),
        adminConsentDescription: "Access as user",
        adminConsentDisplayName: "Access as user",
        isEnabled: true,
        type: "User",
        value: "access_as_user",
      };

      const allScopes = hasAccessAsUser ? existingScopes : [...existingScopes, accessAsUserScope];
      const scopeId = hasAccessAsUser
        ? existingScopes.find((s) => s.value === "access_as_user")!.id
        : accessAsUserScope.id;

      // Build pre-authorized apps
      const existingPreAuth = (fullApp.api as Record<string, unknown>)?.preAuthorizedApplications as Array<{ appId: string; delegatedPermissionIds: string[] }> ?? [];

      const preAuthApps = [...existingPreAuth];
      for (const clientAppId of [TEAMS_DESKTOP_CLIENT, TEAMS_WEB_CLIENT]) {
        if (!preAuthApps.some((p) => p.appId === clientAppId)) {
          preAuthApps.push({ appId: clientAppId, delegatedPermissionIds: [scopeId] });
        }
      }

      // Build redirect URIs
      const existingWeb = fullApp.web as Record<string, unknown> ?? {};
      const existingRedirects = (existingWeb.redirectUris as string[]) ?? [];
      const bfRedirect = "https://token.botframework.com/.auth/web/redirect";
      const redirectUris = existingRedirects.includes(bfRedirect)
        ? existingRedirects
        : [...existingRedirects, bfRedirect];

      // Build identifier URIs
      const existingIdentifierUris = (fullApp.identifierUris as string[]) ?? [];
      const identifierUris = existingIdentifierUris.includes(identifierUri)
        ? existingIdentifierUris
        : [...existingIdentifierUris, identifierUri];

      // PATCH 1: Add identifier URI, scopes, and redirect URI
      // (must be separate from pre-authorized apps — Graph needs the scope to exist first)
      await updateAadApp(graphToken, aadApp.id, {
        identifierUris,
        api: {
          oauth2PermissionScopes: allScopes,
        },
        web: {
          ...existingWeb,
          redirectUris,
        },
      });

      // PATCH 2: Add pre-authorized apps (scope now exists)
      await updateAadApp(graphToken, aadApp.id, {
        api: {
          oauth2PermissionScopes: allScopes,
          preAuthorizedApplications: preAuthApps,
        },
      });

      aadSpinner.success({ text: "AAD app configured for SSO" });
    } catch (error) {
      aadSpinner.error({ text: "Failed to configure AAD app" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }

    // Step 2: Create OAuth connection for SSO
    const oauthSpinner = createSilentSpinner("Creating SSO connection...", silent).start();
    try {
      runAz([
        "bot", "authsetting", "create",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--setting-name", connectionName,
        "--service", "Aadv2",
        "--client-id", botId,
        "--client-secret", clientSecret,
        "--provider-scope-string", scopes,
        "--parameters",
        `tenantId=${azure.tenantId}`,
        `tokenExchangeUrl=api://${botId}`,
        "--subscription", azure.subscription,
      ]);
      oauthSpinner.success({ text: `SSO connection "${connectionName}" created` });
    } catch (error) {
      oauthSpinner.error({ text: "Failed to create SSO connection" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }

    // Step 3: Update TDP manifest with webApplicationInfo
    let manifestUpdated = false;
    const manifestSpinner = createSilentSpinner("Updating manifest...", silent).start();
    try {
      const details = await fetchAppDetailsV2(token, appId);
      const validDomains = (details.validDomains as string[]) ?? [];
      const updates: Record<string, unknown> = {
        webApplicationInfoId: botId,
        webApplicationInfoResource: `api://botid-${botId}`,
      };

      if (!validDomains.includes("token.botframework.com")) {
        updates.validDomains = [...validDomains, "token.botframework.com"];
      }

      await updateAppDetails(token, appId, updates);
      manifestSpinner.success({ text: "Manifest updated with SSO configuration" });
      manifestUpdated = true;
    } catch (error) {
      manifestSpinner.error({ text: "Failed to update manifest" });
      logger.error(error instanceof Error ? error.message : "Unknown error");
      // Non-fatal — SSO connection was created, manifest can be updated manually
    }

    if (options.json) {
      const result: SsoSetupOutput = {
        botId,
        connectionName,
        identifierUri: `api://botid-${botId}`,
        scopes,
        clientSecretCreated,
        manifestUpdated,
      };
      outputJson(result);
    } else {
      console.log(pc.bold(pc.green("\nSSO configured!")));
      console.log(`${pc.dim("Connection name:")} ${connectionName}`);
      console.log(`${pc.dim("Identifier URI:")} api://${botId}`);
      console.log(`${pc.dim("Scopes:")} ${scopes}`);
    }
  });
