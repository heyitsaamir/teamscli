import { Command } from "commander";
import { execSync } from "node:child_process";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import { logger } from "../utils/logger.js";

const INSTALL_URL =
  "https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz";

/**
 * Run the self-update. Returns true on success, false on failure.
 */
export function runSelfUpdate(): boolean {
  const spinner = createSpinner("Updating teams...").start();

  try {
    execSync(`npm install -g ${INSTALL_URL}`, { stdio: "pipe" });
    spinner.success({ text: "Updated to the latest version" });

    try {
      const version = execSync("teams --version", { encoding: "utf-8" }).trim();
      logger.info(`${pc.dim("Version:")} ${version}`);
    } catch {
      // version check is best-effort
    }
    return true;
  } catch (error) {
    spinner.error({ text: "Update failed" });
    logger.error(
      pc.red(error instanceof Error ? error.message : "Unknown error"),
    );
    logger.info(
      `\nTry manually: ${pc.cyan(`npm install -g ${INSTALL_URL}`)}`,
    );
    return false;
  }
}

export const selfUpdateCommand = new Command("self-update")
  .description("Update teams to the latest version")
  .action(async () => {
    if (!runSelfUpdate()) {
      process.exit(1);
    }
  });
