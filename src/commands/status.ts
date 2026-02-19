import { Command } from "commander";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import { getAccount, paths } from "../auth/index.js";

export const statusCommand = new Command("status")
    .description("Show current CLI status")
    .option("-v, --verbose", "[OPTIONAL] Show additional details")
    .action(async (options: { verbose?: boolean }) => {
        const spinner = createSpinner("Checking status...").start();
        const account = await getAccount();

        if (!account) {
            spinner.warn({ text: "Not logged in" });
            console.log(`Run ${pc.cyan("teams login")} to authenticate.`);
            return;
        }

        spinner.success({ text: `Logged in as ${account.username}` });

        if (options.verbose) {
            console.log(`\n${pc.dim("Tenant ID:")} ${account.tenantId}`);
            console.log(`${pc.dim("Home Account ID:")} ${account.homeAccountId}`);
            console.log(`${pc.dim("Config path:")} ${paths.config}`);
        }
    });
