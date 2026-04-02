import { execFileSync } from "node:child_process";
import pc from "picocolors";
import { logger } from "./logger.js";

export function isAzInstalled(): boolean {
  try {
    execFileSync("az", ["version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function isAzLoggedIn(): boolean {
  try {
    execFileSync("az", ["account", "show"], { stdio: "pipe" });
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
    console.log(
      pc.red("Azure CLI is not installed.") +
        ` Install from ${pc.cyan("https://aka.ms/install-az")}`,
    );
    process.exit(1);
  }

  if (!isAzLoggedIn()) {
    console.log(
      pc.red("Not logged in to Azure CLI.") +
        ` Run ${pc.cyan("az login")} first.`,
    );
    process.exit(1);
  }
}

/**
 * Run an az CLI command and return parsed JSON output.
 * Automatically appends --output json.
 */
export function runAz<T = unknown>(args: string[]): T {
  logger.debug(`az ${args.join(" ")}`);
  const output = execFileSync("az", [...args, "--output", "json"], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const trimmed = output.trim();
  if (!trimmed) return undefined as T;
  return JSON.parse(trimmed) as T;
}
