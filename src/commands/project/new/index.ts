import { Command } from "commander";
import { select, input } from "@inquirer/prompts";
import { isInteractive } from "../../../utils/interactive.js";
import { projectNewTypescriptCommand } from "./typescript.js";
import { projectNewCsharpCommand } from "./csharp.js";
import { projectNewPythonCommand } from "./python.js";

export const projectNewCommand = new Command("new")
  .description("Create a new Teams app project")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    while (true) {
      try {
        const language = await select({
          message: "Select language",
          choices: [
            { name: "TypeScript", value: "typescript" },
            { name: "C#", value: "csharp" },
            { name: "Python", value: "python" },
            { name: "Back", value: "back" },
          ],
        });

        if (language === "back") return;

        const name = await input({ message: "App name:" });
        if (!name.trim()) continue;

        const cmd =
          language === "typescript"
            ? projectNewTypescriptCommand
            : language === "csharp"
              ? projectNewCsharpCommand
              : projectNewPythonCommand;

        await cmd.parseAsync([name], { from: "user" });
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") return;
        throw error;
      }
    }
  });

projectNewCommand.addCommand(projectNewTypescriptCommand);
projectNewCommand.addCommand(projectNewCsharpCommand);
projectNewCommand.addCommand(projectNewPythonCommand);
