import { search } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../auth/index.js";
import { fetchApps } from "../apps/index.js";
import type { AppSummary } from "../apps/types.js";
import { isInteractive } from "./interactive.js";

export interface PickAppResult {
  app: AppSummary;
  token: string;
}

/**
 * Authenticate, fetch apps, and show a searchable picker.
 * Returns the selected app and the TDP token for further API calls.
 * In non-TTY environments, prints an error and exits (prompts can't work).
 */
export async function pickApp(): Promise<PickAppResult> {
  if (!isInteractive()) {
    console.log(pc.red("Missing app ID.") + ` Pass ${pc.cyan("<appId>")} as the first argument in non-interactive mode.`);
    process.exit(1);
  }

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
  let apps: AppSummary[];
  try {
    apps = await fetchApps(token);
    spinner.stop();
  } catch (error) {
    spinner.error({ text: "Failed to fetch apps" });
    console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }

  if (apps.length === 0) {
    console.log(pc.dim("No apps found."));
    process.exit(0);
  }

  console.log(pc.dim(`Tip: pass ${pc.cyan("<appId>")} as the first argument to skip this prompt`));

  try {
    const app = await search({
      message: "Select an app",
      source: (term) => {
        const filtered = term
          ? apps.filter((a) =>
              (a.appName ?? "").toLowerCase().includes(term.toLowerCase())
            )
          : apps;
        return filtered.map((a) => ({
          name: `${a.appName ?? "Unnamed"} ${pc.dim(`(${a.teamsAppId})`)}`,
          value: a,
        }));
      },
    });

    return { app, token };
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      process.exit(0);
    }
    throw error;
  }
}
