import { Command } from "commander";
import { select } from "@inquirer/prompts";
import pc from "picocolors";
import { getConfig, setConfig } from "../../utils/config.js";
import { isInteractive } from "../../utils/interactive.js";
import { CliError, wrapAction } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { BotLocation } from "../../apps/bot-location.js";

const botLocationCommand = new Command("default-bot-location")
  .description("Default bot location for app create (bf or azure)")
  .argument("[value]", "Set to 'bf' or 'azure'. Omit to show current value or pick interactively.")
  .action(wrapAction(async (value?: string) => {
    const current = ((await getConfig("default-bot-location")) as BotLocation) ?? "bf";

    if (!value && isInteractive()) {
      value = await select({
        message: "Default bot location",
        choices: [
          { name: "BF tenant (no Azure subscription needed)", value: "bf" },
          { name: "Azure (requires az CLI + subscription)", value: "azure" },
        ],
        default: current,
      });
    }

    if (!value) {
      logger.info(current);
      return;
    }

    if (value !== "bf" && value !== "azure") {
      throw new CliError("VALIDATION_FORMAT", `Invalid value: ${value}. Must be 'bf' or 'azure'.`);
    }

    if (value === current) {
      logger.info(pc.dim(`default-bot-location is already ${value}`));
      return;
    }

    await setConfig("default-bot-location", value);
    logger.info(`${pc.dim("default-bot-location")} = ${pc.bold(pc.green(value))}`);
  }));

export const configCommand = new Command("config")
  .description("Manage CLI configuration")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    while (true) {
      const current = ((await getConfig("default-bot-location")) as BotLocation) ?? "bf";

      try {
        const setting = await select({
          message: "Configure",
          choices: [
            { name: `Default bot location ${pc.dim(`(${current})`)}`, value: "default-bot-location" },
            { name: "Back", value: "back" },
          ],
        });

        if (setting === "back") return;

        if (setting === "default-bot-location") {
          await botLocationCommand.parseAsync([], { from: "user" });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") return;
        throw error;
      }
    }
  });

configCommand.addCommand(botLocationCommand);
