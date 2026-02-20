import { Command } from "commander";
import { readFile } from "node:fs/promises";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { uploadManifest } from "../../../apps/index.js";
import type { TeamsManifest } from "../../../apps/api.js";
import { appContext } from "../context.js";

export const manifestUploadCommand = new Command("upload")
  .description("Upload a manifest.json to update an existing Teams app (requires --id on parent app command)")
  .argument("<file-path>", "Path to manifest.json file")
  .action(async (filePath: string) => {
    const id = appContext.appId;
    if (!id) {
      console.log(pc.red("Missing required option: --id <appId>"));
      console.log(pc.dim("Usage: teams app --id <appId> manifest upload <file-path>"));
      process.exit(1);
    }
    const account = await getAccount();
    if (!account) {
      console.log(pc.red("Not logged in.") + ` Run ${pc.cyan("teams login")} first.`);
      process.exit(1);
    }

    const token = await getTokenSilent(teamsDevPortalScopes);
    if (!token) {
      console.log(pc.red("Failed to get token.") + ` Try ${pc.cyan("teams login")} again.`);
      process.exit(1);
    }

    // Read and parse manifest file
    let manifest: TeamsManifest;
    try {
      const content = await readFile(filePath, "utf-8");
      manifest = JSON.parse(content) as TeamsManifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.log(pc.red(`File not found: ${filePath}`));
      } else if (error instanceof SyntaxError) {
        console.log(pc.red(`Invalid JSON in ${filePath}: ${error.message}`));
      } else {
        console.log(pc.red(`Failed to read ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
      process.exit(1);
    }

    // Basic validation
    if (!manifest.name?.short) {
      console.log(pc.red("Invalid manifest: missing name.short"));
      process.exit(1);
    }
    if (!manifest.version) {
      console.log(pc.red("Invalid manifest: missing version"));
      process.exit(1);
    }

    const spinner = createSpinner("Uploading manifest...").start();

    try {
      const result = await uploadManifest(token, id, manifest);
      spinner.success({ text: "Manifest uploaded successfully" });
      console.log(`${pc.dim("App:")} ${result.shortName}`);
      console.log(`${pc.dim("Version:")} ${result.version}`);
    } catch (error) {
      spinner.error({ text: "Failed to upload manifest" });
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
