import { Command } from "commander";
import { manifestCreateCommand } from "./create.js";

export const manifestCommand = new Command("manifest")
  .description("Manage Teams app manifests");

manifestCommand.addCommand(manifestCreateCommand);
