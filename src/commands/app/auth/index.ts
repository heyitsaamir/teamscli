import { Command } from "commander";
import { secretCommand } from "./secret/index.js";

export const authCommand = new Command("auth")
  .description("Manage app authentication");

authCommand.addCommand(secretCommand);
