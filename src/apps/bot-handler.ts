import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSpinner } from "nanospinner";
import { registerBot, fetchBot, updateBot } from "./tdp.js";
import { runAz } from "../utils/az.js";
import { logger } from "../utils/logger.js";

export interface CreateBotOpts {
  botId: string;
  name: string;
  endpoint?: string;
  description?: string;
}

export interface BotHandler {
  createBot(opts: CreateBotOpts): Promise<void>;
  validateCreateBot(opts: CreateBotOpts): Promise<void>;
  updateEndpoint(botId: string, endpoint: string): Promise<void>;
}

export interface AzureContext {
  subscription: string;
  resourceGroup: string;
  region: string;
  tenantId: string;
}

/**
 * Bot handler that creates/manages bots in the BF tenant via TDP.
 */
class TdpBotHandler implements BotHandler {
  constructor(private token: string) {}

  async createBot(opts: CreateBotOpts): Promise<void> {
    await registerBot(this.token, {
      botId: opts.botId,
      name: opts.name,
      endpoint: opts.endpoint ?? "",
    });
  }

  async validateCreateBot(): Promise<void> {
    // TDP creation has no pre-validation — it either works or throws
  }

  async updateEndpoint(botId: string, endpoint: string): Promise<void> {
    const bot = await fetchBot(this.token, botId);
    await updateBot(this.token, { ...bot, messagingEndpoint: endpoint });
  }
}

/**
 * Generate an ARM template for Azure Bot Service.
 */
function generateArmTemplate(opts: CreateBotOpts, azure: AzureContext): object {
  return {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    resources: [
      {
        type: "Microsoft.BotService/botServices",
        apiVersion: "2021-03-01",
        name: opts.botId,
        location: "global",
        kind: "azurebot",
        sku: { name: "F0" },
        properties: {
          displayName: opts.description || opts.name,
          endpoint: opts.endpoint || "",
          msaAppId: opts.botId,
          msaAppType: "SingleTenant",
          msaAppTenantId: azure.tenantId,
        },
      },
    ],
  };
}

/**
 * Write an ARM template to a temp file, run the callback, then clean up.
 */
function withArmTemplate(template: object, fn: (templatePath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "teams-cli-"));
  const templatePath = join(dir, "azuredeploy.json");
  try {
    writeFileSync(templatePath, JSON.stringify(template, null, 2));
    fn(templatePath);
  } finally {
    try { unlinkSync(templatePath); } catch { /* best effort cleanup */ }
  }
}

/**
 * Bot handler that creates/manages bots in Azure via az CLI.
 * Uses ARM templates with what-if validation.
 */
class AzureBotHandler implements BotHandler {
  constructor(private azure: AzureContext) {}

  async createBot(opts: CreateBotOpts): Promise<void> {
    const template = generateArmTemplate(opts, this.azure);

    withArmTemplate(template, (templatePath) => {
      // Deploy the ARM template
      logger.debug(`Deploying Azure bot: ${opts.botId} (${opts.name}) in ${this.azure.resourceGroup}`);
      runAz([
        "deployment", "group", "create",
        "--resource-group", this.azure.resourceGroup,
        "--template-file", templatePath,
        "--subscription", this.azure.subscription,
      ]);
    });

    // Enable the Microsoft Teams channel (ARM template doesn't configure channels)
    logger.debug("Enabling Microsoft Teams channel");
    runAz([
      "bot", "msteams", "create",
      "--name", opts.botId,
      "--resource-group", this.azure.resourceGroup,
      "--subscription", this.azure.subscription,
    ]);
  }

  /**
   * Validate that createBot would succeed without creating any resources.
   * Uses ARM template what-if to check permissions, name availability, etc.
   * Throws if validation fails.
   */
  async validateCreateBot(opts: CreateBotOpts): Promise<void> {
    const template = generateArmTemplate(opts, this.azure);

    withArmTemplate(template, (templatePath) => {
      logger.debug("Running ARM what-if validation");
      runAz([
        "deployment", "group", "what-if",
        "--resource-group", this.azure.resourceGroup,
        "--template-file", templatePath,
        "--subscription", this.azure.subscription,
        "--no-pretty-print",
      ]);
    });
  }

  async updateEndpoint(botId: string, endpoint: string): Promise<void> {
    logger.debug(`Updating Azure bot endpoint: ${botId} → ${endpoint}`);
    runAz([
      "bot", "update",
      "--name", botId,
      "--resource-group", this.azure.resourceGroup,
      "--endpoint", endpoint,
      "--subscription", this.azure.subscription,
    ]);
  }
}

export function createTdpBotHandler(token: string): BotHandler {
  return new TdpBotHandler(token);
}

export function createAzureBotHandler(context: AzureContext): BotHandler {
  return new AzureBotHandler(context);
}

/**
 * Discover the Azure context for an existing bot by looking up its resource.
 * The bot resource name is always the client ID (set at creation time).
 */
export function discoverAzureBot(botId: string): AzureContext | null {
  const spinner = createSpinner("Discovering Azure bot...").start();
  try {
    const results = runAz<Array<{ resourceGroup: string; location: string }>>(
      ["resource", "list",
        "--resource-type", "Microsoft.BotService/botServices",
        "--name", botId],
    );
    if (results.length === 0) {
      spinner.stop();
      return null;
    }
    const bot = results[0];
    const account = runAz<{ id: string; tenantId: string }>(["account", "show"]);
    spinner.success({ text: "Azure bot discovered" });
    return {
      subscription: account.id,
      resourceGroup: bot.resourceGroup,
      region: bot.location,
      tenantId: account.tenantId,
    };
  } catch {
    spinner.stop();
    return null;
  }
}
