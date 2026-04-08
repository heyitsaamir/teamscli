import AdmZip from "adm-zip";
import { writeFile } from "node:fs/promises";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { downloadAppPackage } from "../../../apps/index.js";
import { logger } from "../../../utils/logger.js";

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
