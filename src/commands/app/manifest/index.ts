import { Command } from "commander";
import { select, input } from "@inquirer/prompts";
import pc from "picocolors";
import { fetchApp } from "../../../apps/index.js";
import { pickApp } from "../../../utils/app-picker.js";
import { isInteractive } from "../../../utils/interactive.js";
import { downloadManifest, uploadManifestFromFile } from "./actions.js";
import { manifestDownloadCommand } from "./download.js";
import { manifestUploadCommand } from "./upload.js";

export const appManifestCommand = new Command("manifest")
  .description("Download or upload app manifests")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    while (true) {
      try {
        const picked = await pickApp();
        const app = await fetchApp(picked.token, picked.app.teamsAppId);

        while (true) {
          const action = await select({
            message: `${app.appName ?? "Unnamed"} — manifest:`,
            choices: [
              { name: "Download", value: "download" },
              { name: "Upload", value: "upload" },
              { name: "Back", value: "back" },
            ],
          });

          if (action === "back") break;

          if (action === "download") {
            const savePath = await input({
              message: "Save to (leave empty to print):",
              default: "",
            });

            try {
              await downloadManifest(picked.token, app.appId, savePath || undefined);
            } catch (error) {
              console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
            }
            continue;
          }

          if (action === "upload") {
            const filePath = await input({
              message: "Path to manifest.json:",
              default: "manifest.json",
            });

            try {
              await uploadManifestFromFile(picked.token, app.teamsAppId, filePath);
            } catch (error) {
              console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
            }
            continue;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") {
          return;
        }
        throw error;
      }
    }
  });

appManifestCommand.addCommand(manifestDownloadCommand);
appManifestCommand.addCommand(manifestUploadCommand);
