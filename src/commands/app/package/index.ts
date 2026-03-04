import { Command } from "commander";
import { packageDownloadCommand } from "./download.js";

export const appPackageCommand = new Command("package")
  .description("Manage app packages");

appPackageCommand.addCommand(packageDownloadCommand);
