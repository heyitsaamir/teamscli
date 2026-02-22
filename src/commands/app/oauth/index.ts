import { Command } from "commander";
import { oauthListCommand } from "./list.js";
import { oauthGetCommand } from "./get.js";
import { oauthCreateCommand } from "./create.js";
import { oauthDeleteCommand } from "./delete.js";

export const oauthCommand = new Command("oauth")
  .description("Manage OAuth configurations for a Teams app");

oauthCommand.addCommand(oauthListCommand);
oauthCommand.addCommand(oauthGetCommand);
oauthCommand.addCommand(oauthCreateCommand);
oauthCommand.addCommand(oauthDeleteCommand);
