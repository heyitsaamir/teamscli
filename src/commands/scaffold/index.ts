import { Command } from "commander";
import { scaffoldManifestCommand } from "./manifest.js";
import { isInteractive } from "../../utils/interactive.js";

export const scaffoldCommand = new Command("scaffold")
  .description("Scaffold project files")
  .action(async function (this: Command) {
    if (!isInteractive()) {
      this.help();
      return;
    }

    await scaffoldManifestCommand.parseAsync([], { from: "user" });
  });

scaffoldCommand.addCommand(scaffoldManifestCommand);
