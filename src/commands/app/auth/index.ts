import { Command } from "commander";
import { secretCommand } from "./secret/index.js";
import { isInteractive } from "../../../utils/interactive.js";

export const authCommand = new Command("auth")
  .description("Manage app authentication")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    await secretCommand.parseAsync([], { from: "user" });
  });

authCommand.addCommand(secretCommand);
