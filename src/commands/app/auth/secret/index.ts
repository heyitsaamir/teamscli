import { Command } from "commander";
import { secretCreateCommand } from "./create.js";

export const secretCommand = new Command("secret")
  .description("Manage app secrets");

secretCommand.addCommand(secretCreateCommand);
