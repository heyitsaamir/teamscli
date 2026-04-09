import { Command } from "commander";
import { select, checkbox, Separator } from "@inquirer/prompts";
import pc from "picocolors";
import { createSilentSpinner } from "../../../utils/spinner.js";
import { logger } from "../../../utils/logger.js";
import { CliError, wrapAction } from "../../../utils/errors.js";
import { outputJson } from "../../../utils/json-output.js";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import {
  inferScope,
  findPermission,
  getPermissionsForScope,
  type RscScope,
} from "../../../apps/rsc-catalog.js";
import type { RscPermissionEntry, AppSummary } from "../../../apps/types.js";
import { listRscPermissions, addRscPermissions, removeRscPermissions } from "./actions.js";

// ─── Interactive menu ───────────────────────────────────────────────

/**
 * Show the RSC permissions interactive menu for an app.
 * Flow: pick scope → toggle permissions on/off → save diff.
 */
export async function showRscMenu(app: AppSummary, token: string): Promise<void> {
  while (true) {
    const scope = await select<RscScope | "view" | "back">({
      message: `${app.appName ?? "Unnamed"} — Permissions (RSC):`,
      choices: [
        { name: "View current permissions", value: "view" },
        new Separator(),
        { name: "Edit Team permissions", value: "Team" },
        { name: "Edit Chat / Meeting permissions", value: "Chat" },
        { name: "Edit User permissions", value: "User" },
        new Separator(),
        { name: "Back", value: "back" },
      ],
    });

    if (scope === "back") return;

    if (scope === "view") {
      await viewPermissions(token, app.teamsAppId);
    } else {
      await editScopePermissions(token, app.teamsAppId, scope);
    }
  }
}

async function viewPermissions(token: string, teamsAppId: string): Promise<void> {
  const spinner = createSilentSpinner("Fetching RSC permissions...").start();
  const permissions = await listRscPermissions(token, teamsAppId);
  spinner.stop();

  if (permissions.length === 0) {
    logger.info(pc.dim("No RSC permissions configured."));
    return;
  }

  printPermissionsTable(permissions);
}

function printPermissionsTable(permissions: RscPermissionEntry[]): void {
  const rows = permissions.map((p) => ({
    name: p.name,
    scope: inferScope(p.name) ?? "Unknown",
    type: p.type,
    inCatalog: findPermission(p.name) !== null,
  }));

  const nameCol = Math.max("Name".length, ...rows.map((r) => r.name.length));
  const scopeCol = Math.max("Scope".length, ...rows.map((r) => r.scope.length));

  logger.info(pc.bold(`${"Name".padEnd(nameCol + 2)}${"Scope".padEnd(scopeCol + 2)}Type`));
  logger.info(pc.dim("─".repeat(nameCol + scopeCol + 2 + 2 + "Application".length)));
  for (const row of rows) {
    const suffix = row.inCatalog ? "" : ` ${pc.dim("(not in catalog)")}`;
    logger.info(`${row.name.padEnd(nameCol + 2)}${row.scope.padEnd(scopeCol + 2)}${row.type}${suffix}`);
  }
}

/**
 * Show all permissions for a scope as a single checkbox list.
 * Already-enabled permissions are pre-checked.
 * Computes the diff on submit: newly checked = add, newly unchecked = remove.
 */
async function editScopePermissions(token: string, teamsAppId: string, scope: RscScope): Promise<void> {
  const spinner = createSilentSpinner("Fetching RSC permissions...").start();
  const current = await listRscPermissions(token, teamsAppId);
  spinner.stop();

  const currentNames = new Set(current.map((p) => p.name));
  const catalog = getPermissionsForScope(scope);

  // Build checkbox choices with current permissions pre-checked
  const choices: Array<{ name: string; value: RscPermissionEntry; checked?: boolean } | Separator> = [];

  if (catalog.Application.length > 0) {
    choices.push(new Separator(pc.bold("── Application ──")));
    for (const perm of catalog.Application) {
      choices.push({
        name: `${perm.displayName} ${pc.dim(`(${perm.name})`)}`,
        value: { name: perm.name, type: "Application" },
        checked: currentNames.has(perm.name),
      });
    }
  }

  if (catalog.Delegated.length > 0) {
    choices.push(new Separator(pc.bold("── Delegated ──")));
    for (const perm of catalog.Delegated) {
      choices.push({
        name: `${perm.displayName} ${pc.dim(`(${perm.name})`)}`,
        value: { name: perm.name, type: "Delegated" },
        checked: currentNames.has(perm.name),
      });
    }
  }

  const selected = await checkbox<RscPermissionEntry>({
    message: `${scope} RSC permissions (space to toggle, enter to save):`,
    choices,
  });

  // Compute diff
  const selectedNames = new Set(selected.map((p) => p.name));
  const scopeSuffix = scope === "Team" ? ".Group" : scope === "Chat" ? ".Chat" : ".User";
  const currentScopeNames = new Set(current.filter((p) => p.name.endsWith(scopeSuffix)).map((p) => p.name));

  const toAdd = selected.filter((p) => !currentScopeNames.has(p.name));
  const toRemove = [...currentScopeNames].filter((name) => !selectedNames.has(name));

  if (toAdd.length === 0 && toRemove.length === 0) {
    logger.info(pc.dim("No changes."));
    return;
  }

  const updateSpinner = createSilentSpinner("Updating RSC permissions...").start();

  if (toAdd.length > 0) {
    await addRscPermissions(token, teamsAppId, toAdd);
  }
  if (toRemove.length > 0) {
    await removeRscPermissions(token, teamsAppId, toRemove);
  }

  const parts: string[] = [];
  if (toAdd.length > 0) parts.push(`added ${toAdd.length}`);
  if (toRemove.length > 0) parts.push(`removed ${toRemove.length}`);
  updateSpinner.success({ text: `RSC permissions updated (${parts.join(", ")}).` });
}

// ─── Helpers ────────────────────────────────────────────────────────

async function requireToken(): Promise<string> {
  const account = await getAccount();
  if (!account) {
    throw new CliError("AUTH_REQUIRED", "Not logged in.", "Run `teams login` first.");
  }
  const token = await getTokenSilent(teamsDevPortalScopes);
  if (!token) {
    throw new CliError("AUTH_TOKEN_FAILED", "Failed to get token.", "Try `teams login` again.");
  }
  return token;
}

// ─── CLI subcommands ────────────────────────────────────────────────

interface RscListOptions {
  json?: boolean;
}

interface RscAddOptions {
  type: "Application" | "Delegated";
  json?: boolean;
}

interface RscRemoveOptions {
  json?: boolean;
}

interface RscListOutput {
  permissions: RscPermissionEntry[];
}

interface RscAddOutput {
  added: RscPermissionEntry[];
  skipped: RscPermissionEntry[];
}

interface RscRemoveOutput {
  removed: string[];
  notFound: string[];
}

const rscListCommand = new Command("list")
  .description("List RSC permissions for an app")
  .argument("<teamsAppId>", "Teams app ID")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(wrapAction(async (teamsAppId: string, options: RscListOptions) => {
    const token = await requireToken();
    const permissions = await listRscPermissions(token, teamsAppId);

    if (options.json) {
      const result: RscListOutput = { permissions };
      outputJson(result);
      return;
    }

    if (permissions.length === 0) {
      logger.info(pc.dim("No RSC permissions configured."));
      return;
    }

    printPermissionsTable(permissions);
  }));

const rscAddCommand = new Command("add")
  .description("Add an RSC permission to an app")
  .argument("<teamsAppId>", "Teams app ID")
  .argument("<permission>", "RSC permission name (e.g. ChannelMessage.Read.Group)")
  .requiredOption("--type <type>", "Permission type: Application or Delegated")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(wrapAction(async (teamsAppId: string, permission: string, options: RscAddOptions) => {
    if (options.type !== "Application" && options.type !== "Delegated") {
      throw new CliError("VALIDATION_FORMAT", `Invalid type "${options.type}".`, "Use --type Application or --type Delegated.");
    }

    const token = await requireToken();
    const entry: RscPermissionEntry = { name: permission, type: options.type };

    const spinner = createSilentSpinner("Adding RSC permission...", options.json).start();
    const { added, skipped } = await addRscPermissions(token, teamsAppId, [entry]);
    spinner.stop();

    if (options.json) {
      const result: RscAddOutput = { added, skipped };
      outputJson(result);
      return;
    }

    if (skipped.length > 0) {
      logger.info(pc.yellow(`Permission "${permission}" already exists.`));
    } else {
      logger.info(pc.green(`Added ${permission} (${options.type}).`));
    }
  }));

const rscRemoveCommand = new Command("remove")
  .description("Remove an RSC permission from an app")
  .argument("<teamsAppId>", "Teams app ID")
  .argument("<permission>", "RSC permission name (e.g. ChannelMessage.Read.Group)")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(wrapAction(async (teamsAppId: string, permission: string, options: RscRemoveOptions) => {
    const token = await requireToken();

    const spinner = createSilentSpinner("Removing RSC permission...", options.json).start();
    const { removed, notFound } = await removeRscPermissions(token, teamsAppId, [permission]);
    spinner.stop();

    if (options.json) {
      const result: RscRemoveOutput = { removed, notFound };
      outputJson(result);
      return;
    }

    if (notFound.length > 0) {
      throw new CliError("NOT_FOUND_APP", `Permission "${permission}" not found on this app.`);
    }

    logger.info(pc.green(`Removed ${permission}.`));
  }));

export const rscCommand = new Command("rsc")
  .description("Manage RSC (Resource-Specific Consent) permissions");

rscCommand.addCommand(rscListCommand);
rscCommand.addCommand(rscAddCommand);
rscCommand.addCommand(rscRemoveCommand);
