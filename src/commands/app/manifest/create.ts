import { Command } from "commander";
import { input } from "@inquirer/prompts";
import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  createManifest,
  collectManifestCustomization,
  PLACEHOLDER_BOT_ID,
} from "../../../apps/index.js";
import { logger } from "../../../utils/logger.js";

interface ManifestCreateOptions {
  path?: string;
  name?: string;
  domain?: string;
  botId?: string;
  interactive?: boolean;
}

export const manifestCreateCommand = new Command("create")
  .description("Create a Teams app manifest.json file")
  .option("-p, --path <path>", "[OPTIONAL] Output directory (default: current directory)")
  .option("-n, --name <name>", "App name")
  .option("-d, --domain <domain>", "[OPTIONAL] Valid domain for the manifest")
  .option("-b, --bot-id <id>", "[OPTIONAL] Bot ID (uses placeholder if not provided)")
  .option("-i, --interactive", "[OPTIONAL] Force interactive mode even when args provided")
  .action(async (options: ManifestCreateOptions) => {
    const outputDir = options.path ?? process.cwd();

    // Determine if we need interactive mode
    const hasRequiredArgs = !!options.name;
    const useInteractive = options.interactive || !hasRequiredArgs;

    let name: string;
    let botId: string;
    let domain: string | undefined;
    let description: { short: string; full?: string } | undefined;
    let scopes: string[] | undefined;
    let developer:
      | {
          name: string;
          websiteUrl: string;
          privacyUrl: string;
          termsOfUseUrl: string;
        }
      | undefined;

    if (useInteractive) {
      // Interactive mode: prompt for missing values and customization
      name = options.name ?? (await input({ message: "App name:" }));
      botId =
        options.botId ??
        ((await input({
          message: `Bot ID (leave empty for placeholder):`,
        })) ||
          PLACEHOLDER_BOT_ID);
      domain =
        options.domain ??
        ((await input({
          message: "Valid domain (leave empty to skip):",
        })) ||
          undefined);

      // Collect customization options
      const customization = await collectManifestCustomization();
      description = customization.description;
      scopes = customization.scopes;
      developer = customization.developer;
    } else {
      // Non-interactive mode: use provided values with defaults
      name = options.name!;
      botId = options.botId ?? PLACEHOLDER_BOT_ID;
      domain = options.domain;
    }

    // Validate name is not empty
    if (!name.trim()) {
      logger.error("App name cannot be empty");
      process.exit(1);
    }

    // Build endpoint from domain if provided (for validDomains)
    const endpoint = domain ? `https://${domain}/api/messages` : undefined;

    // Create manifest
    const manifest = createManifest({
      botId,
      botName: name,
      endpoint,
      description,
      scopes,
      developer,
    });

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write manifest.json
    const outputPath = path.join(outputDir, "manifest.json");
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

    logger.info(pc.bold(pc.green("Manifest created successfully!")));
    logger.info(`Output: ${pc.cyan(outputPath)}`);

    if (botId === PLACEHOLDER_BOT_ID) {
      logger.warn(
        `Using placeholder bot ID. Update ${pc.cyan("id")} and ${pc.cyan("bots[0].botId")} with your actual bot ID.`
      );
    }
  });
