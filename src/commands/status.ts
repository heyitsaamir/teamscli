import { Command } from "commander";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import { getAccount, paths } from "../auth/index.js";
import { isAzInstalled, isAzLoggedIn, runAz } from "../utils/az.js";
import { logger } from "../utils/logger.js";

export const statusCommand = new Command("status")
    .description("Show current CLI status")
    .option("-v, --verbose", "[OPTIONAL] Show additional details")
    .action(async (options: { verbose?: boolean }) => {
        const spinner = createSpinner("Checking status...").start();
        const account = await getAccount();

        if (!account) {
            spinner.warn({ text: "Not logged in" });
            logger.info(`Run ${pc.cyan("teams login")} to authenticate.`);
            return;
        }

        spinner.success({ text: `Logged in as ${account.username}` });

        if (options.verbose) {
            logger.info(`\n${pc.dim("Tenant ID:")} ${account.tenantId}`);
            logger.info(`${pc.dim("Home Account ID:")} ${account.homeAccountId}`);
            logger.info(`${pc.dim("Config path:")} ${paths.config}`);
        }

        // Azure CLI status
        if (!isAzInstalled()) {
            logger.info(`\n${pc.dim("Azure CLI:")} ${pc.yellow("not installed")}`);
        } else if (!isAzLoggedIn()) {
            logger.info(`\n${pc.dim("Azure CLI:")} installed, ${pc.yellow("not logged in")}`);
        } else {
            try {
                const sub = runAz<{ name: string; id: string }>(["account", "show"]);
                logger.info(`\n${pc.dim("Azure CLI:")} ${pc.green("connected")}`);
                logger.info(`${pc.dim("Subscription:")} ${sub.name} ${pc.dim(`(${sub.id})`)}`);
            } catch {
                logger.info(`\n${pc.dim("Azure CLI:")} installed, ${pc.yellow("status unknown")}`);
            }
        }
    });
