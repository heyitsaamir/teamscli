import { registerBot, fetchBot, updateBot } from "./tdp.js";
import { runAz } from "../utils/az.js";
import { logger } from "../utils/logger.js";

export interface CreateBotOpts {
  botId: string;
  name: string;
  endpoint?: string;
}

export interface BotHandler {
  createBot(opts: CreateBotOpts): Promise<void>;
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

  async updateEndpoint(botId: string, endpoint: string): Promise<void> {
    const bot = await fetchBot(this.token, botId);
    await updateBot(this.token, { ...bot, messagingEndpoint: endpoint });
  }
}

/**
 * Bot handler that creates/manages bots in Azure via az CLI.
 */
class AzureBotHandler implements BotHandler {
  constructor(private azure: AzureContext) {}

  async createBot(opts: CreateBotOpts): Promise<void> {
    // Use the client ID as the Azure resource name — always valid, always unique.
    // The display name (opts.name) is passed as --description.
    const resourceName = opts.botId;
    logger.debug(`Creating Azure bot: ${resourceName} (${opts.name}) in ${this.azure.resourceGroup}`);
    runAz([
      "bot", "create",
      "--app-type", "SingleTenant",
      "--appid", opts.botId,
      "--tenant-id", this.azure.tenantId,
      "--name", resourceName,
      "--description", opts.name,
      "--resource-group", this.azure.resourceGroup,
      "--location", this.azure.region,
      ...(opts.endpoint ? ["--endpoint", opts.endpoint] : []),
      "--subscription", this.azure.subscription,
    ]);

    // Enable the Microsoft Teams channel (az bot create only enables webchat + directline)
    logger.debug("Enabling Microsoft Teams channel");
    runAz([
      "bot", "msteams", "create",
      "--name", resourceName,
      "--resource-group", this.azure.resourceGroup,
      "--subscription", this.azure.subscription,
    ]);
  }

  async updateEndpoint(botId: string, endpoint: string): Promise<void> {
    // Azure resource name is always the client ID (set at creation time)
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
  try {
    const results = runAz<Array<{ resourceGroup: string; location: string }>>(
      ["resource", "list",
        "--resource-type", "Microsoft.BotService/botServices",
        "--name", botId],
    );
    if (results.length === 0) return null;
    const bot = results[0];
    // Get current subscription
    const account = runAz<{ id: string; tenantId: string }>(["account", "show"]);
    return {
      subscription: account.id,
      resourceGroup: bot.resourceGroup,
      region: bot.location,
      tenantId: account.tenantId,
    };
  } catch {
    return null;
  }
}
