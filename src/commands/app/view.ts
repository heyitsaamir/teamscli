import { Command } from "commander";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../auth/index.js";
import { fetchApp, fetchAppDetailsV2, showAppDetail } from "../../apps/index.js";
import { parseJsonFields, pickFields, outputJson } from "../../utils/json-output.js";
import { pickApp } from "../../utils/app-picker.js";

const VIEW_JSON_FIELDS = [
  "appId",
  "teamsAppId",
  "name",
  "longName",
  "version",
  "developer",
  "shortDescription",
  "longDescription",
  "websiteUrl",
  "privacyUrl",
  "termsOfUseUrl",
  "endpoint",
  "installLink",
];

export const appViewCommand = new Command("view")
  .description("View a Teams app")
  .argument("[appId]", "App ID")
  .option("--json <fields>", "[OPTIONAL] Output as JSON with specified fields")
  .option("--web", "[OPTIONAL] Print the Teams install link")
  .action(async (appIdArg: string | undefined, options) => {
    // Interactive picker loop when no appId
    if (!appIdArg) {
      while (true) {
        try {
          const picked = await pickApp();
          const app = await fetchApp(picked.token, picked.app.teamsAppId);
          await showAppDetail(app, picked.token, { interactive: true });
        } catch (error) {
          if (error instanceof Error && error.name === "ExitPromptError") {
            return;
          }
          throw error;
        }
      }
    }

    // Scripting mode: --id provided
    const account = await getAccount();
    if (!account) {
      console.log(pc.red("Not logged in.") + ` Run ${pc.cyan("teams login")} first.`);
      process.exit(1);
    }

    const token = (await getTokenSilent(teamsDevPortalScopes))!;
    if (!token) {
      console.log(pc.red("Failed to get token.") + ` Try ${pc.cyan("teams login")} again.`);
      process.exit(1);
    }

    try {
      const app = await fetchApp(token, appIdArg);

      if (options.json) {
        const fields = parseJsonFields(options.json, VIEW_JSON_FIELDS);
        const spinner = createSpinner("Fetching app details...").start();
        const details = await fetchAppDetailsV2(token, app.teamsAppId);
        spinner.stop();

        const enriched: Record<string, unknown> = {
          appId: details.appId,
          teamsAppId: details.teamsAppId,
          name: details.shortName,
          longName: details.longName,
          version: details.version,
          developer: details.developerName,
          shortDescription: details.shortDescription,
          longDescription: details.longDescription,
          websiteUrl: details.websiteUrl,
          privacyUrl: details.privacyUrl,
          termsOfUseUrl: details.termsOfUseUrl,
          endpoint: details.bots?.[0]?.messagingEndpoint ?? null,
          installLink: `https://teams.microsoft.com/l/app/${details.teamsAppId}?installAppPackage=true`,
        };

        outputJson(pickFields(enriched as Record<string, unknown>, fields));
        return;
      }

      if (options.web) {
        const installLink = `https://teams.microsoft.com/l/app/${app.teamsAppId}?installAppPackage=true`;
        console.log(`${pc.dim("App:")} ${app.appName || app.appId}`);
        console.log(`${pc.dim("Install link:")} ${installLink}`);
        return;
      }

      await showAppDetail(app, token);
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
