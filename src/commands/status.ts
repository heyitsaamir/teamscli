import { Command } from "commander";
import pc from "picocolors";
import { getAccount, paths } from "../auth/index.js";

export const statusCommand = new Command("status")
    .description("Show current CLI status")
    .option("-v, --verbose", "Show additional details")
    .action(async (options: { verbose?: boolean }) => {
        const account = await getAccount();

        if (!account) {
            console.log(pc.yellow("Not logged in.") + ` Run ${pc.cyan("teams login")} to authenticate.`);
            return;
        }

        console.log(`${pc.dim("Logged in: ")} ${pc.bold(pc.green(account.username))}`);

        if (options.verbose) {
            console.log(`\n${pc.dim("Tenant ID:")} ${account.tenantId}`);
            console.log(`${pc.dim("Home Account ID:")} ${account.homeAccountId}`);
            console.log(`${pc.dim("Config path:")} ${paths.config}`);
        }
    });
