import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import { writeFile } from "node:fs/promises";
import { createSilentSpinner } from "../../utils/spinner.js";
import { showEditMenu } from "./edit.js";
import { showAppDetail, downloadAppPackage } from "../../apps/index.js";
import { logger } from "../../utils/logger.js";
import { downloadManifest } from "./manifest/actions.js";
import { authCommand } from "./auth/index.js";
import { userAuthCommand } from "./user-auth/index.js";
import { appDoctorCommand } from "./doctor.js";
import type { AppSummary } from "../../apps/types.js";

/**
 * Show an action submenu for a specific app.
 * Returns when user selects "Back".
 */
export async function showAppActions(app: AppSummary, token: string): Promise<void> {
  while (true) {
    const action = await select({
      message: `${app.appName ?? "Unnamed"}:`,
      choices: [
        { name: "View", value: "view" },
        { name: "Edit", value: "edit" },
        { name: "Download package", value: "package" },
        { name: "Download manifest", value: "manifest" },
        { name: "Auth (secrets)", value: "credentials" },
        { name: "User Auth (OAuth/SSO)", value: "user-auth" },
        { name: "Doctor (diagnostics)", value: "doctor" },
        { name: "Back", value: "back" },
      ],
    });

    if (action === "back") return;

    if (action === "view") {
      await showAppDetail(app, token, { interactive: true });
    } else if (action === "edit") {
      await showEditMenu(app, token);
    } else if (action === "package") {
      const outputPath = `${(app.appName || app.appId).replace(/\s+/g, "-")}.zip`;
      const spinner = createSilentSpinner("Downloading package...").start();
      const packageBuffer = await downloadAppPackage(token, app.appId);
      spinner.stop();
      await writeFile(outputPath, packageBuffer);
      logger.info(pc.green(`Package saved to ${outputPath}`));
    } else if (action === "manifest") {
      const savePath = await input({
        message: `${app.appName ?? "Unnamed"} — save manifest to (leave empty to print):`,
        default: "",
      });
      try {
        await downloadManifest(token, app.appId, savePath || undefined);
      } catch (error) {
        logger.error(pc.red(error instanceof Error ? error.message : "Unknown error"));
      }
    } else if (action === "credentials") {
      try {
        await authCommand.parseAsync(["secret", "create", app.teamsAppId], { from: "user" });
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") continue;
        logger.error(pc.red(error instanceof Error ? error.message : "Unknown error"));
      }
    } else if (action === "user-auth") {
      try {
        await userAuthCommand.parseAsync([], { from: "user" });
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") continue;
        logger.error(pc.red(error instanceof Error ? error.message : "Unknown error"));
      }
    } else if (action === "doctor") {
      try {
        await appDoctorCommand.parseAsync([app.teamsAppId], { from: "user" });
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") continue;
        logger.error(pc.red(error instanceof Error ? error.message : "Unknown error"));
      }
    }
  }
}
