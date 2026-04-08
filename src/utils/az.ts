import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";
import { logger } from "./logger.js";
import { CliError } from "./errors.js";

const execFileAsync = promisify(execFile);

// Resolve the correct Azure CLI executable for the platform
const AZ_COMMAND = platform() === "win32" ? "az.cmd" : "az";

export async function isAzInstalled(): Promise<boolean> {
  try {
    await execFileAsync(AZ_COMMAND, ["version"]);
    return true;
  } catch {
    return false;
  }
}

export async function isAzLoggedIn(): Promise<boolean> {
  try {
    await execFileAsync(AZ_COMMAND, ["account", "show"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure Azure CLI is installed and logged in. Exits with helpful message if not.
 */
export async function ensureAz(): Promise<void> {
  if (!(await isAzInstalled())) {
    throw new CliError("TOOL_AZ_NOT_INSTALLED", "Azure CLI is not installed.", "Install from https://aka.ms/install-az");
  }

  if (!(await isAzLoggedIn())) {
    throw new CliError("TOOL_AZ_NOT_LOGGED_IN", "Not logged in to Azure CLI.", "Run `az login` first.");
  }
}

/**
 * Run an az CLI command and return parsed JSON output.
 * Automatically appends --output json.
 */
export async function runAz<T = unknown>(args: string[]): Promise<T> {
  logger.debug(`${AZ_COMMAND} ${args.join(" ")}`);
  const { stdout } = await execFileAsync(AZ_COMMAND, [...args, "--output", "json"], {
    encoding: "utf-8",
  });
  const trimmed = stdout.trim();
  if (!trimmed) return undefined as T;
  return JSON.parse(trimmed) as T;
}
