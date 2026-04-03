import { confirm, search, select } from "@inquirer/prompts";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { runAz } from "./az.js";
import { isInteractive } from "./interactive.js";
import { logger } from "./logger.js";

interface AzSubscription {
  id: string;
  name: string;
  isDefault: boolean;
}

interface AzResourceGroup {
  name: string;
  location: string;
}

let cachedSubscription: AzSubscription | null = null;

/**
 * Resolve the Azure subscription to use.
 * - Flag value always wins
 * - Session cache used if already confirmed
 * - Interactive: confirm default or pick from list
 * - Non-interactive: required flag
 */
export async function resolveSubscription(flagValue?: string): Promise<string> {
  if (flagValue) return flagValue;

  if (cachedSubscription) return cachedSubscription.id;

  if (!isInteractive()) {
    console.log(
      pc.red("--subscription is required in non-interactive mode.") +
        ` Use ${pc.cyan("az account list")} to find your subscription ID.`,
    );
    process.exit(1);
  }

  // Get current default subscription
  let spinner = createSpinner("Fetching Azure subscriptions...").start();
  const current = runAz<AzSubscription>(["account", "show"]);
  spinner.stop();

  const useDefault = await confirm({
    message: `Azure subscription: ${pc.bold(current.name)} (${pc.dim(current.id)}). Use this?`,
    default: true,
  });

  if (useDefault) {
    cachedSubscription = current;
    return current.id;
  }

  // Pick a different subscription
  spinner = createSpinner("Fetching Azure subscriptions...").start();
  const subs = runAz<AzSubscription[]>(["account", "list"]);
  spinner.stop();
  const picked = await search<AzSubscription>({
    message: "Select a subscription",
    source: (term) => {
      const filtered = term
        ? subs.filter((s) => s.name.toLowerCase().includes(term.toLowerCase()))
        : subs;
      return filtered.map((s) => ({
        name: `${s.name} ${pc.dim(`(${s.id})`)}`,
        value: s,
      }));
    },
  });

  cachedSubscription = picked;
  return picked.id;
}

/**
 * Resolve the Azure resource group to use.
 * - Flag value always wins (assumes existing group)
 * - Interactive: pick existing or create new
 * - Non-interactive: required flag
 */
export async function resolveResourceGroup(
  subscription: string,
  flagValue?: string,
): Promise<string> {
  if (flagValue) return flagValue;

  if (!isInteractive()) {
    console.log(
      pc.red("--resource-group is required in non-interactive mode."),
    );
    process.exit(1);
  }

  const rgSpinner = createSpinner("Fetching resource groups...").start();
  const groups = runAz<AzResourceGroup[]>([
    "group", "list",
    "--subscription", subscription,
  ]);
  rgSpinner.stop();

  if (groups.length === 0) {
    console.log(pc.yellow("No resource groups found in this subscription."));
    console.log(
      `Create one with: ${pc.cyan("--resource-group <name> --create-resource-group")}`,
    );
    process.exit(1);
  }

  const picked = await search<string>({
    message: "Select a resource group",
    source: (term) => {
      const filtered = term
        ? groups.filter((g) =>
            g.name.toLowerCase().includes(term.toLowerCase()),
          )
        : groups;
      return filtered.map((g) => ({
        name: `${g.name} ${pc.dim(`(${g.location})`)}`,
        value: g.name,
      }));
    },
  });

  return picked;
}
