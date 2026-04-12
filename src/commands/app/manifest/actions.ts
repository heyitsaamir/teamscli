import AdmZip from "adm-zip";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { downloadAppPackage, uploadManifest, type TeamsManifest } from "../../../apps/index.js";
import { CliError } from "../../../utils/errors.js";
import { logger } from "../../../utils/logger.js";
import { createSilentSpinner } from "../../../utils/spinner.js";

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
    logger.info(pc.green(`Manifest saved to ${filePath}`));
  } else {
    logger.info(JSON.stringify(manifestJson, null, 2));
  }
}

/**
 * Upload a local manifest.json to update an existing app.
 * Reads the file, validates it's a Teams manifest, and uploads via TDP API.
 * Throws on failure.
 */
export async function uploadManifestFromFile(
  token: string,
  teamsAppId: string,
  filePath: string,
  silent = false,
): Promise<void> {
  const resolved = path.resolve(filePath);

  let raw: string;
  try {
    raw = await readFile(resolved, "utf-8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new CliError("VALIDATION_MISSING", `File not found: ${resolved}`);
    }
    throw new CliError("VALIDATION_FORMAT", `Cannot read file: ${resolved}`);
  }

  let manifest: TeamsManifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new CliError("VALIDATION_FORMAT", `File is not valid JSON: ${resolved}`);
  }

  if (!manifest.manifestVersion || !manifest.name?.short || !manifest.description?.short) {
    throw new CliError(
      "VALIDATION_FORMAT",
      "File does not appear to be a valid Teams manifest.",
      "Ensure it has manifestVersion, name.short, and description.short.",
    );
  }

  const spinner = createSilentSpinner("Uploading manifest...", silent).start();
  try {
    await uploadManifest(token, teamsAppId, manifest);
  } catch (error) {
    spinner.error({ text: "Upload failed" });
    throw error;
  }
  spinner.success({ text: "Manifest uploaded" });

  if (!silent) {
    logger.info(pc.green(`Manifest from ${pc.bold(resolved)} applied to app ${pc.bold(teamsAppId)}`));
  }
}
