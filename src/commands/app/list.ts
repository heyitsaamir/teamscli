import { Command } from "commander";
import { search } from "@inquirer/prompts";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../auth/index.js";
import { fetchApps, fetchApp } from "../../apps/index.js";
import { showAppActions } from "./actions.js";
import { parseJsonFields, pickFields, outputJson } from "../../utils/json-output.js";
import { isInteractive } from "../../utils/interactive.js";

const LIST_JSON_FIELDS = ["appId", "teamsAppId", "appName", "version", "updatedAt"];

export async function runAppList(options?: { json?: string }): Promise<void> {
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

  const spinner = createSpinner("Fetching apps...").start();
  let apps;
  try {
    apps = await fetchApps(token);
    spinner.stop();
  } catch (error) {
    spinner.error({ text: "Failed to fetch apps" });
    console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }

  if (apps.length === 0) {
    if (options?.json) {
      outputJson([]);
      return;
    }
    console.log(pc.dim("No apps found."));
    return;
  }

  if (options?.json) {
    const fields = parseJsonFields(options.json, LIST_JSON_FIELDS);
    outputJson(pickFields(apps, fields));
    return;
  }

  if (!isInteractive()) {
    // Non-interactive: output all apps as JSON
    outputJson(apps);
    return;
  }

  while (true) {
    try {
      const selected = await search({
        message: "Select an app",
        source: (term) => {
          const filtered = term
            ? apps.filter((app) =>
                (app.appName ?? "").toLowerCase().includes(term.toLowerCase())
              )
            : apps;
          return filtered.map((app) => ({
            name: `${app.appName ?? "Unnamed"} ${pc.dim(`(${app.teamsAppId})`)}`,
            value: app,
          }));
        },
      });

      const app = await fetchApp(token, selected.teamsAppId);
      await showAppActions(app, token);
    } catch (error) {
      // User cancelled prompt (Escape/Ctrl+C), exit gracefully
      if (error instanceof Error && error.name === "ExitPromptError") {
        return;
      }
      throw error;
    }
  }
}

export const appListCommand = new Command("list")
  .description("List your Teams apps")
  .option("--json <fields>", "[OPTIONAL] Output as JSON with specified fields")
  .action(async (options) => {
    await runAppList(options);
  });
