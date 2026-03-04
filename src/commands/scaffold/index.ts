import { Command } from "commander";
import { scaffoldManifestCommand } from "./manifest.js";

export const scaffoldCommand = new Command("scaffold")
  .description("Scaffold project files");

scaffoldCommand.addCommand(scaffoldManifestCommand);
