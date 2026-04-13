import { Command } from "commander";
import { select } from "@inquirer/prompts";
import pc from "picocolors";
import { logger } from "../../../utils/logger.js";
import { isInteractive } from "../../../utils/interactive.js";
import { detectLanguage, listToolkits } from "../../../project/scaffold.js";
import { projectConfigAddCommand } from "./add.js";
import { projectConfigRemoveCommand } from "./remove.js";

export const projectConfigCommand = new Command("config")
  .description("Manage Agents Toolkit configuration for a project")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    while (true) {
      try {
        const action = await select({
          message: "Project config",
          choices: [
            { name: "Add toolkit config", value: "add" },
            { name: "Remove toolkit config", value: "remove" },
            { name: "Back", value: "back" },
          ],
        });

        if (action === "back") return;

        const language = detectLanguage();
        if (!language) {
          logger.error(
            pc.red("Could not detect project language. Are you in the right folder?"),
          );
          continue;
        }

        const toolkits = listToolkits(language);
        if (toolkits.length === 0) {
          logger.warn(pc.yellow(`No toolkit configs available for ${language}.`));
          continue;
        }

        const toolkit = await select({
          message: `Select toolkit config (${language})`,
          choices: [
            ...toolkits.map((t) => ({ name: `atk.${t}`, value: `atk.${t}` })),
            { name: "Back", value: "back" },
          ],
        });

        if (toolkit === "back") continue;

        const cmd =
          action === "add" ? projectConfigAddCommand : projectConfigRemoveCommand;
        await cmd.parseAsync([toolkit], { from: "user" });
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") return;
        throw error;
      }
    }
  });

projectConfigCommand.addCommand(projectConfigAddCommand);
projectConfigCommand.addCommand(projectConfigRemoveCommand);
