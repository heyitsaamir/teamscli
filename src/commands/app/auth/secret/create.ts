import { Command } from "commander";
import pc from "picocolors";
import {
	getAccount,
	getTokenSilent,
	teamsDevPortalScopes,
} from "../../../../auth/index.js";
import { logger } from "../../../../utils/logger.js";
import { pickApp } from "../../../../utils/app-picker.js";
import { generateSecret } from "./generate.js";

interface SecretCreateOptions {
	env?: string;
	json?: boolean;
}

export const secretCreateCommand = new Command("create")
	.description("Generate a new client secret for an existing app")
	.argument("[appId]", "App ID")
	.option("--env <path>", "[OPTIONAL] Path to .env file to write credentials")
	.option("--json", "[OPTIONAL] Output as JSON")
	.action(async (appIdArg: string | undefined, options: SecretCreateOptions) => {
		let appId: string;
		let tdpToken: string;

		if (appIdArg) {
			const account = await getAccount();
			if (!account) {
				logger.error(`Not logged in. Run ${pc.cyan("teams login")} first.`);
				process.exit(1);
			}

			const token = await getTokenSilent(teamsDevPortalScopes);
			if (!token) {
				logger.error(`Failed to get TDP token. Try ${pc.cyan("teams login")} again.`);
				process.exit(1);
			}
			appId = appIdArg;
			tdpToken = token;
		} else {
			const picked = await pickApp();
			appId = picked.app.teamsAppId;
			tdpToken = picked.token;
		}

		try {
			await generateSecret({
				tdpToken,
				appId,
				envPath: options.env,
				interactive: !options.env && !options.json,
				json: options.json,
			});
		} catch (error) {
			logger.error(
				error instanceof Error
					? error.message
					: "Failed to generate secret",
			);
			process.exit(1);
		}
	});
