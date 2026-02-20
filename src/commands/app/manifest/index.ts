import { Command } from "commander";
import { manifestCreateCommand } from "./create.js";
import { manifestDownloadCommand } from "./download.js";
import { manifestUploadCommand } from "./upload.js";

export const manifestCommand = new Command("manifest")
  .description("Manage Teams app manifests");

manifestCommand.addCommand(manifestCreateCommand);
manifestCommand.addCommand(manifestDownloadCommand);
manifestCommand.addCommand(manifestUploadCommand);
