import { Command } from "commander";
import { execSync } from "node:child_process";
import { createSpinner } from "nanospinner";
import pc from "picocolors";

const INSTALL_URL =
  "https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz";

export const selfUpdateCommand = new Command("self-update")
  .description("Update teams2 to the latest version")
  .action(async () => {
    const spinner = createSpinner("Updating teams2...").start();

    try {
      execSync(`npm install -g ${INSTALL_URL}`, { stdio: "pipe" });
      spinner.success({ text: "Updated to the latest version" });

      try {
        const version = execSync("teams2 --version", { encoding: "utf-8" }).trim();
        console.log(`${pc.dim("Version:")} ${version}`);
      } catch {
        // version check is best-effort
      }
    } catch (error) {
      spinner.error({ text: "Update failed" });
      console.log(
        pc.red(error instanceof Error ? error.message : "Unknown error"),
      );
      console.log(
        `\nTry manually: ${pc.cyan(`npm install -g ${INSTALL_URL}`)}`,
      );
      process.exit(1);
    }
  });
