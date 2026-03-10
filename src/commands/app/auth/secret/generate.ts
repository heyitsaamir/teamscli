import { input } from "@inquirer/prompts";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import {
	createClientSecret,
	fetchApp,
	getAadAppByClientId,
} from "../../../../apps/index.js";
import {
	getAccount,
	getTokenSilent,
	graphScopes,
} from "../../../../auth/index.js";
import { outputCredentials } from "../../../../utils/env.js";

interface GenerateSecretOptions {
	/** TDP auth token */
	tdpToken: string;
	/** Teams app ID */
	appId: string;
	/** Explicit .env path (skips prompt) */
	envPath?: string;
	/** When true, prompt for .env path if not provided */
	interactive?: boolean;
}

/**
 * Core secret generation logic. Acquires graph token, looks up bot/AAD app,
 * creates secret, and outputs credentials.
 *
 * Throws on failure. Caller decides how to handle errors.
 */
export async function generateSecret(opts: GenerateSecretOptions): Promise<void> {
	let envPath = opts.envPath;

	if (envPath === undefined && opts.interactive) {
		envPath = (await input({
			message: "Path to .env file (leave empty to show in terminal):",
		})) || undefined;
	}

	const account = await getAccount();
	if (!account) {
		throw new Error(`Not logged in. Run ${pc.cyan("teams login")} first.`);
	}

	let spinner = createSpinner("Acquiring Graph token...").start();
	const graphToken = await getTokenSilent(graphScopes);
	if (!graphToken) {
		spinner.error({ text: "Failed to get Graph token" });
		throw new Error(`Try ${pc.cyan("teams login")} again.`);
	}
	spinner.success({ text: "Graph token acquired" });

	spinner = createSpinner("Fetching app details...").start();
	const app = await fetchApp(opts.tdpToken, opts.appId);

	if (!app.bots || app.bots.length === 0) {
		spinner.error({ text: "This app has no bots" });
		throw new Error("This app has no bots");
	}

	const clientId = app.bots[0].botId;
	spinner.success({ text: `Found bot (${clientId})` });

	spinner = createSpinner("Looking up AAD app...").start();
	const aadApp = await getAadAppByClientId(graphToken, clientId);
	spinner.success({ text: `Found AAD app (${aadApp.displayName})` });

	spinner = createSpinner("Generating client secret...").start();
	const secret = await createClientSecret(graphToken, aadApp.id);
	spinner.success({ text: "Generated client secret" });

	outputCredentials(envPath, {
		CLIENT_ID: clientId,
		CLIENT_SECRET: secret.secretText,
	}, "Secret generated successfully!");
}
