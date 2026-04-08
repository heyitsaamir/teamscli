import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import { writeFile } from "node:fs/promises";
import { createSilentSpinner } from "../../utils/spinner.js";
import { showEditMenu } from "./edit.js";
import { showAppDetail, downloadAppPackage } from "../../apps/index.js";
import { logger } from "../../utils/logger.js";
import { downloadManifest } from "./manifest/actions.js";
import { generateSecret } from "./auth/secret/generate.js";
import { oauthAddCommand } from "./auth/oauth/add.js";
import { oauthListCommand } from "./auth/oauth/list.js";
import { oauthRemoveCommand } from "./auth/oauth/remove.js";
import { ssoSetupCommand } from "./auth/sso/setup.js";
import { ssoEditCommand } from "./auth/sso/edit.js";
import { ssoRemoveCommand } from "./auth/sso/remove.js";
import { requireAzureBot } from "./auth/require-azure.js";
import { runAz } from "../../utils/az.js";
import { appDoctorCommand } from "./doctor.js";
import type { AppSummary } from "../../apps/types.js";

async function showAuthMenu(appId: string, _token: string): Promise<void> {
  const action = await select({
    message: "User authentication",
    choices: [
      { name: "OAuth connections", value: "oauth" },
      { name: "SSO", value: "sso" },
      { name: "Back", value: "back" },
    ],
  });

  if (action === "back") return;

  if (action === "oauth") {
    const oauthAction = await select({
      message: "OAuth connections",
      choices: [
        { name: "Add connection", value: "add" },
        { name: "List connections", value: "list" },
        { name: "Remove connection", value: "remove" },
        { name: "Back", value: "back" },
      ],
    });

    if (oauthAction === "back") return;
    if (oauthAction === "add") await oauthAddCommand.parseAsync([appId], { from: "user" });
    else if (oauthAction === "list") await oauthListCommand.parseAsync([appId], { from: "user" });
    else if (oauthAction === "remove") await oauthRemoveCommand.parseAsync([appId], { from: "user" });
  } else if (action === "sso") {
    interface AuthSetting {
      name: string;
      properties?: {
        serviceProviderDisplayName?: string;
        scopes?: string;
      };
    }

    const { botId, azure } = await requireAzureBot(appId);

    const ssoSpinner = createSilentSpinner("Fetching SSO connections...").start();
    const settings = await runAz<AuthSetting[]>([
      "bot", "authsetting", "list",
      "--name", botId,
      "--resource-group", azure.resourceGroup,
      "--subscription", azure.subscription,
    ]);
    ssoSpinner.stop();

    const aadConnections = settings.filter((s) => {
      const provider = s.properties?.serviceProviderDisplayName ?? "";
      return provider.includes("Azure Active Directory");
    });

    const connectionChoices = aadConnections.map((s) => {
      const name = s.name.split("/").pop() ?? s.name;
      return {
        name: s.properties?.scopes ? `${name} ${pc.dim(`(${s.properties.scopes})`)}` : name,
        value: `edit:${name}`,
      };
    });

    const ssoAction = await select({
      message: "SSO",
      choices: [
        ...connectionChoices,
        { name: "Set up new SSO connection", value: "setup" },
        { name: "Back", value: "back" },
      ],
    });

    if (ssoAction === "back") return;
    if (ssoAction === "setup") await ssoSetupCommand.parseAsync([appId], { from: "user" });
    else if (ssoAction.startsWith("edit:")) {
      const connectionName = ssoAction.slice(5);
      await ssoEditCommand.parseAsync([appId, "--connection-name", connectionName], { from: "user" });
    }
  }
}

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
        { name: "Generate secret", value: "secret" },
        { name: "User Auth (OAuth/SSO)", value: "auth" },
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
    } else if (action === "secret") {
      try {
        await generateSecret({ tdpToken: token, appId: app.teamsAppId, interactive: true });
      } catch (error) {
        logger.error(pc.red(error instanceof Error ? error.message : "Unknown error"));
      }
    } else if (action === "auth") {
      try {
        await showAuthMenu(app.teamsAppId, token);
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
