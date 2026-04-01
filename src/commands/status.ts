import { Command } from "commander";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import { getAccount, paths } from "../auth/index.js";
import { isAzInstalled, isAzLoggedIn, runAz } from "../utils/az.js";

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

        // Azure CLI status
        if (!isAzInstalled()) {
            console.log(`\n${pc.dim("Azure CLI:")} ${pc.yellow("not installed")}`);
        } else if (!isAzLoggedIn()) {
            console.log(`\n${pc.dim("Azure CLI:")} installed, ${pc.yellow("not logged in")}`);
        } else {
            try {
                const sub = runAz<{ name: string; id: string }>(["account", "show"]);
                console.log(`\n${pc.dim("Azure CLI:")} ${pc.green("connected")}`);
                console.log(`${pc.dim("Subscription:")} ${sub.name} ${pc.dim(`(${sub.id})`)}`);
            } catch {
                console.log(`\n${pc.dim("Azure CLI:")} installed, ${pc.yellow("status unknown")}`);
            }
        }
    });
