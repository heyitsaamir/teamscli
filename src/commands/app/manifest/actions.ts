import AdmZip from "adm-zip";
import { readFile, writeFile } from "node:fs/promises";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { downloadAppPackage, uploadManifest } from "../../../apps/index.js";
import type { TeamsManifest } from "../../../apps/api.js";
import type { AppDetails } from "../../../apps/types.js";

/**
 * Download manifest from an app package. Saves to file or prints to stdout.
 * Throws on failure.
 */
export async function downloadManifest(token: string, appId: string, filePath?: string): Promise<void> {
  const spinner = createSpinner("Downloading manifest...").start();

  const packageBuffer = await downloadAppPackage(token, appId);
  const zip = new AdmZip(packageBuffer);
  const manifestEntry = zip.getEntry("manifest.json");

  if (!manifestEntry) {
    spinner.error({ text: "manifest.json not found in package" });
    throw new Error("manifest.json not found in package");
  }

  const manifestContent = manifestEntry.getData().toString("utf-8");
  const manifestJson = JSON.parse(manifestContent);

  spinner.success({ text: "Manifest downloaded" });

  if (filePath) {
    await writeFile(filePath, JSON.stringify(manifestJson, null, 2));
    console.log(pc.green(`Manifest saved to ${filePath}`));
  } else {
    console.log(JSON.stringify(manifestJson, null, 2));
  }
}

/**
 * Read, validate, and upload a manifest.json to update an existing app.
 * Returns updated app details. Throws on failure.
 */
export async function uploadManifestFromFile(token: string, teamsAppId: string, filePath: string): Promise<AppDetails> {
  let manifest: TeamsManifest;
  try {
    const content = await readFile(filePath, "utf-8");
    manifest = JSON.parse(content) as TeamsManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    throw new Error(`Failed to read ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  if (!manifest.name?.short) {
    throw new Error("Invalid manifest: missing name.short");
  }
  if (!manifest.version) {
    throw new Error("Invalid manifest: missing version");
  }

  const spinner = createSpinner("Uploading manifest...").start();

  try {
    const result = await uploadManifest(token, teamsAppId, manifest);
    spinner.success({ text: "Manifest uploaded successfully" });
    console.log(`${pc.dim("App:")} ${result.shortName}`);
    console.log(`${pc.dim("Version:")} ${result.version}`);
    return result;
  } catch (error) {
    spinner.error({ text: "Failed to upload manifest" });
    throw error;
  }
}
