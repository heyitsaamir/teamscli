import { Command } from "commander";
import { input, select, confirm } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { createOAuthConfiguration } from "../../../apps/index.js";
import { appContext } from "../context.js";

const httpsUrlRegex = /^https:\/\/\S+$/i;

export const oauthCreateCommand = new Command("create")
  .description("Create a new OAuth configuration (requires --id on parent app command)")
  .option("--description <desc>", "Description for the OAuth configuration")
  .option("--client-id <id>", "OAuth client ID")
  .option("--client-secret <secret>", "OAuth client secret")
  .option("--auth-endpoint <url>", "Authorization endpoint URL (HTTPS)")
  .option("--token-endpoint <url>", "Token exchange endpoint URL (HTTPS)")
  .option("--refresh-endpoint <url>", "[OPTIONAL] Token refresh endpoint URL (HTTPS)")
  .option("--scopes <scopes>", "[OPTIONAL] Comma-separated list of scopes")
  .option("--target-urls <urls>", "[OPTIONAL] Comma-separated list of target URLs (HTTPS)")
  .option("--any-app", "[OPTIONAL] Make config applicable to any app (default: specific app)")
  .option("--any-tenant", "[OPTIONAL] Make config applicable to any tenant (default: home tenant)")
  .option("--pkce", "[OPTIONAL] Enable PKCE")
  .action(async (options) => {
    const appId = appContext.appId;

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
      // Collect required fields interactively if not provided
      const description =
        options.description ??
        (await input({
          message: "Description:",
          validate: (val) => (val.trim().length > 0 && val.length <= 126) || "Required, max 126 characters",
        }));

      const clientId =
        options.clientId ??
        (await input({
          message: "Client ID:",
          validate: (val) => (val.trim().length > 0 && val.length <= 126) || "Required, max 126 characters",
        }));

      const clientSecret =
        options.clientSecret ??
        (await input({
          message: "Client Secret:",
          validate: (val) =>
            (val.length >= 10 && val.length <= 2048) || "Required, 10-2048 characters",
        }));

      const authorizationEndpoint =
        options.authEndpoint ??
        (await input({
          message: "Authorization endpoint URL:",
          validate: (val) => httpsUrlRegex.test(val) || "Must be a valid HTTPS URL",
        }));

      const tokenExchangeEndpoint =
        options.tokenEndpoint ??
        (await input({
          message: "Token exchange endpoint URL:",
          validate: (val) => httpsUrlRegex.test(val) || "Must be a valid HTTPS URL",
        }));

      const tokenRefreshEndpoint =
        options.refreshEndpoint ??
        ((await input({
          message: "Token refresh endpoint URL (leave empty to skip):",
          validate: (val) => val === "" || httpsUrlRegex.test(val) || "Must be a valid HTTPS URL",
        })) || undefined);

      // Scopes
      const scopesInput =
        options.scopes ??
        (await input({
          message: "Scopes (comma-separated, leave empty to skip):",
        }));
      const scopes = scopesInput
        ? scopesInput.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

      // Target URLs
      const targetUrlsInput =
        options.targetUrls ??
        (await input({
          message: "Target URLs (comma-separated HTTPS URLs, leave empty to skip):",
        }));
      const targetUrlsShouldStartWith = targetUrlsInput
        ? targetUrlsInput.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

      // Applicable to apps
      let applicableToApps: "SpecificApp" | "AnyApp";
      let m365AppId: string | undefined;

      if (options.anyApp) {
        applicableToApps = "AnyApp";
      } else if (appId) {
        // If app ID was provided via --id, use it
        applicableToApps = "SpecificApp";
        m365AppId = appId;
      } else {
        // Ask user
        applicableToApps = await select({
          message: "Applicable to:",
          choices: [
            { name: "Specific App", value: "SpecificApp" as const },
            { name: "Any App", value: "AnyApp" as const },
          ],
        });

        if (applicableToApps === "SpecificApp") {
          m365AppId = await input({
            message: "M365 App ID:",
            validate: (val) => val.trim().length > 0 || "Required for specific app",
          });
        }
      }

      // Target audience
      const targetAudience: "HomeTenant" | "AnyTenant" = options.anyTenant
        ? "AnyTenant"
        : await select({
            message: "Target audience:",
            choices: [
              { name: "Home Tenant", value: "HomeTenant" as const },
              { name: "Any Tenant", value: "AnyTenant" as const },
            ],
          });

      // PKCE
      const isPKCEEnabled = options.pkce ?? (await confirm({ message: "Enable PKCE?", default: false }));

      // Token exchange method
      const tokenExchangeMethodType = await select({
        message: "Token exchange method:",
        choices: [
          { name: "POST Request Body", value: "PostRequestBody" as const },
          { name: "Basic Authorization Header", value: "BasicAuthorizationHeader" as const },
        ],
      });

      // Build config
      const config = {
        description,
        identityProvider: "Custom" as const,
        applicableToApps,
        ...(m365AppId && { m365AppId }),
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

      const spinner = createSpinner("Creating OAuth configuration...").start();

      const created = await createOAuthConfiguration(token, config);
      spinner.success({ text: "OAuth configuration created" });

      console.log();
      console.log(`${pc.dim("ID:")} ${pc.bold(pc.green(created.oAuthConfigId))}`);
      console.log(`${pc.dim("Description:")} ${created.description}`);
      if (created.resourceIdentifierUri) {
        console.log(`${pc.dim("Resource URI:")} ${created.resourceIdentifierUri}`);
      }
      console.log();
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        return;
      }
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
