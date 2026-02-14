import { Command } from "commander";
import pc from "picocolors";

export const appCreateCommand = new Command("create")
  .description("Create a new Teams app")
  .action(async () => {
    // TODO: Implement app creation
    console.log(pc.dim("Not implemented yet."));
  });
