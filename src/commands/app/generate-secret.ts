import { Command } from "commander";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import {
	createClientSecret,
	fetchApp,
	getAadAppByClientId,
} from "../../apps/index.js";
import {
	getAccount,
	getTokenSilent,
	graphScopes,
	teamsDevPortalScopes,
} from "../../auth/index.js";
import { outputCredentials } from "../../utils/env.js";
import { logger } from "../../utils/logger.js";
import { appContext } from "./context.js";

interface GenerateSecretOptions {
	env?: string;
}

export const generateSecretCommand = new Command("generate-secret")
	.description("Generate a new client secret for an existing app")
	.option("--env <path>", "[OPTIONAL] Path to .env file to write credentials")
	.action(async (options: GenerateSecretOptions) => {
		if (!appContext.appId) {
			logger.error(
				`App ID required. Use ${pc.cyan("teams app --id <id> generate-secret")}`,
			);
			process.exit(1);
		}

		const account = await getAccount();
		if (!account) {
			logger.error(`Not logged in. Run ${pc.cyan("teams login")} first.`);
			process.exit(1);
		}

		let spinner = createSpinner("Acquiring tokens...").start();

		const graphToken = await getTokenSilent(graphScopes);
		if (!graphToken) {
			spinner.error({ text: "Failed to get Graph token" });
			logger.error(`Try ${pc.cyan("teams login")} again.`);
			process.exit(1);
		}

		const tdpToken = await getTokenSilent(teamsDevPortalScopes);
		if (!tdpToken) {
			spinner.error({ text: "Failed to get TDP token" });
			logger.error(`Try ${pc.cyan("teams login")} again.`);
			process.exit(1);
		}
		spinner.success({ text: "Tokens acquired" });

		try {
			// Fetch TDP app to get bot's clientId
			spinner = createSpinner("Fetching app details...").start();
			const app = await fetchApp(tdpToken, appContext.appId);

			if (!app.bots || app.bots.length === 0) {
				spinner.error({ text: "This app has no bots" });
				process.exit(1);
			}

			const clientId = app.bots[0].botId;
			spinner.success({ text: `Found bot (${clientId})` });

			// Look up AAD app by clientId to get object ID
			spinner = createSpinner("Looking up AAD app...").start();
			const aadApp = await getAadAppByClientId(graphToken, clientId);
			spinner.success({ text: `Found AAD app (${aadApp.displayName})` });

			// Generate new client secret
			spinner = createSpinner("Generating client secret...").start();
			const secret = await createClientSecret(graphToken, aadApp.id);
			spinner.success({ text: "Generated client secret" });

			outputCredentials(options.env, {
				CLIENT_ID: clientId,
				CLIENT_SECRET: secret.secretText,
				TENANT_ID: account.tenantId,
			}, "Secret generated successfully!");
		} catch (error) {
			spinner.error({ text: "Failed" });
			logger.error(
				error instanceof Error
					? error.message
					: "Failed to generate secret",
			);
			process.exit(1);
		}
	});
