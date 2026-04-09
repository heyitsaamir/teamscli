import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import { logger } from "./logger.js";
import { CliError } from "./errors.js";

// On Windows, .cmd files cannot be executed directly with execFile() due to spawn EINVAL error.
// We use cmd.exe to execute az.cmd, which is safer than shell:true (blocks command injection).
// On Unix, az is a shell script that can be executed directly.
const IS_WINDOWS = platform() === "win32";
const AZ_COMMAND = IS_WINDOWS ? "cmd" : "az";
const AZ_ARGS_PREFIX = IS_WINDOWS ? ["/c", "az.cmd"] : [];

/**
 * Execute Azure CLI command with platform-specific handling.
 * On Windows: cmd /c az.cmd <args>
 * On Unix: az <args>
 */
function execAz(args: string[]): string {
  return execFileSync(AZ_COMMAND, [...AZ_ARGS_PREFIX, ...args], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export function isAzInstalled(): boolean {
  try {
    execAz(["version"]);
    return true;
  } catch {
    return false;
  }
}

export function isAzLoggedIn(): boolean {
  try {
    execAz(["account", "show"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure Azure CLI is installed and logged in. Exits with helpful message if not.
 */
export function ensureAz(): void {
  if (!isAzInstalled()) {
    throw new CliError("TOOL_AZ_NOT_INSTALLED", "Azure CLI is not installed.", "Install from https://learn.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest");
  }

  if (!isAzLoggedIn()) {
    throw new CliError("TOOL_AZ_NOT_LOGGED_IN", "Not logged in to Azure CLI.", "Run `az login` first.");
  }
}

/**
 * Run an az CLI command and return parsed JSON output.
 * Automatically appends --output json.
 */
export function runAz<T = unknown>(args: string[]): T {
  logger.debug(`az ${args.join(" ")}`);
  const output = execAz([...args, "--output", "json"]);
  const trimmed = output.trim();
  if (!trimmed) return undefined as T;
  return JSON.parse(trimmed) as T;
}
