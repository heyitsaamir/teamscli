import { input } from "@inquirer/prompts";
import { Command } from "commander";
import { createSpinner } from "nanospinner";
import pc from "picocolors";
import {
	collectManifestCustomization,
	createAadAppViaTdp,
	createClientSecret,
	createManifestZip,
	createZipFromManifest,
	getAadAppByClientId,
	importAppPackage,
	type ManifestOptions,
	readManifestFile,
	readZipFile,
	registerBot,
	updateManifestBotId,
} from "../../apps/index.js";
import {
	getAccount,
	getTokenSilent,
	graphScopes,
	teamsDevPortalScopes,
} from "../../auth/index.js";
import { outputCredentials } from "../../utils/env.js";
import { logger } from "../../utils/logger.js";
import { isInteractive } from "../../utils/interactive.js";

interface CreateOptions {
	name?: string;
	endpoint?: string;
	manifest?: string;
	package?: string;
	env?: string;
}

export const appCreateCommand = new Command("create")
	.description("Create a new Teams app with bot")
	.option("-n, --name <name>", "App/bot name")
	.option("-e, --endpoint <url>", "[OPTIONAL] Bot messaging endpoint URL")
	.option("-m, --manifest <path>", "[OPTIONAL] Path to manifest.json")
	.option("-p, --package <path>", "[OPTIONAL] Path to app package zip")
	.option("--env <path>", "[OPTIONAL] Path to .env file to write credentials")
	.action(async (options: CreateOptions) => {
		const account = await getAccount();
		if (!account) {
			logger.error(`Not logged in. Run ${pc.cyan("teams login")} first.`);
			process.exit(1);
		}

		// Validate options
		if (options.manifest && options.package) {
			logger.error("Cannot specify both --manifest and --package");
			process.exit(1);
		}

		// ===== Gather all inputs upfront =====
		const interactive = isInteractive();

		if (!interactive && !options.name && !options.package) {
			logger.error("--name is required in non-interactive mode");
			process.exit(1);
		}

		// Determine if any flags were provided (scripting mode)
		const hasFlags = !!(options.name || options.manifest || options.package);

		// Get manifest path (skip prompt if --name provided — implies generation)
		const manifestPath =
			options.manifest ??
			options.package ??
			(interactive && !hasFlags
				? (await input({
						message: "Path to manifest.json (leave empty to generate):",
				  })) || undefined
				: undefined);

		// Get name if not using existing package/manifest
		const name =
			options.name ??
			(options.package
				? undefined
				: interactive && !hasFlags
					? await input({ message: "App name:" })
					: undefined);

		// Get endpoint (prompt only in full interactive mode)
		const endpoint =
			options.endpoint ??
			(interactive && !hasFlags
				? (await input({
						message: "Bot messaging endpoint URL (leave empty to skip):",
				  })) || undefined
				: undefined);

		// Get env path (prompt only in full interactive mode)
		const envPath =
			options.env ??
			(interactive && !hasFlags
				? (await input({
						message: "Path to .env file (leave empty to show in terminal):",
				  })) || undefined
				: undefined);

		// If generating manifest, collect customization options
		const needsGeneratedManifest = !options.package && !manifestPath;
		let descriptionOpts: { short: string; full?: string } | undefined;
		let scopeChoices: string[] | undefined;
		let developerOpts:
			| {
					name: string;
					websiteUrl: string;
					privacyUrl: string;
					termsOfUseUrl: string;
			  }
			| undefined;

		if (needsGeneratedManifest && interactive && !hasFlags) {
			const customization = await collectManifestCustomization();
			descriptionOpts = customization.description;
			scopeChoices = customization.scopes;
			developerOpts = customization.developer;
		}

		// ===== All inputs gathered, now do async work =====

		// Get tokens
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
			let clientId: string;
			let secretText: string;
			let zipBuffer: Buffer;
			let teamsAppId: string;

			if (options.package) {
				// Use existing package - read manifest to get bot ID
				spinner = createSpinner("Reading package...").start();
				zipBuffer = readZipFile(options.package);
				spinner.success({ text: "Package loaded" });

				// Create AAD app via TDP (creates service principal server-side)
				spinner = createSpinner("Creating Azure AD app...").start();
				const aadApp = await createAadAppViaTdp(tdpToken, name ?? "Bot");
				clientId = aadApp.appId;
				spinner.success({ text: `Created Azure AD app (${clientId})` });
			} else {
				// Create AAD app via TDP (creates service principal server-side)
				spinner = createSpinner("Creating Azure AD app...").start();
				const aadApp = await createAadAppViaTdp(tdpToken, name!);
				clientId = aadApp.appId;
				spinner.success({ text: `Created Azure AD app (${clientId})` });

				// Create zip from manifest or generate new one
				if (manifestPath) {
					spinner = createSpinner("Processing manifest...").start();
					const manifest = readManifestFile(manifestPath);
					const updatedManifest = updateManifestBotId(manifest, clientId);
					zipBuffer = createZipFromManifest(updatedManifest);
					spinner.success({ text: "Manifest processed" });
				} else {
					// Generate manifest with pre-collected options
					const manifestOpts: ManifestOptions = {
						botId: clientId,
						botName: name!,
						endpoint,
						description: descriptionOpts,
						scopes: scopeChoices,
						developer: developerOpts,
					};

					zipBuffer = createManifestZip(manifestOpts);
				}
			}

			// Look up Graph object ID (TDP returns a different ID; retry for replication lag)
			spinner = createSpinner("Generating client secret...").start();
			let graphApp: { id: string } | null = null;
			for (let i = 0; i < 10; i++) {
				try {
					graphApp = await getAadAppByClientId(graphToken, clientId);
					break;
				} catch {
					await new Promise((r) => setTimeout(r, 3000));
				}
			}
			if (!graphApp) {
				throw new Error("AAD app not yet available in Graph API. Try again shortly.");
			}
			const secret = await createClientSecret(graphToken, graphApp.id);
			secretText = secret.secretText;
			spinner.success({ text: "Generated client secret" });

			// Import to Teams
			spinner = createSpinner("Creating Teams app...").start();
			const importedApp = await importAppPackage(tdpToken, zipBuffer);
			teamsAppId = importedApp.teamsAppId;
			spinner.success({ text: `Created Teams app (${teamsAppId})` });

			// Register bot
			spinner = createSpinner("Registering bot...").start();
			await registerBot(tdpToken, {
				botId: clientId,
				name: name ?? "Bot",
				endpoint: endpoint ?? "",
			});
			spinner.success({ text: "Registered bot" });

			// Show app details
			const installLink = `https://teams.microsoft.com/l/app/${teamsAppId}?installAppPackage=true`;
			logger.info(pc.bold(pc.green("\nApp created successfully!")));
			logger.info(`${pc.dim("Name:")} ${name ?? "Bot"}`);
			logger.info(`${pc.dim("Teams App ID:")} ${teamsAppId}`);
			logger.info(`${pc.dim("Bot ID:")} ${clientId}`);
			if (endpoint) {
				logger.info(`${pc.dim("Endpoint:")} ${endpoint}`);
			}
			logger.info(`${pc.dim("Install link:")} ${installLink}`);

			outputCredentials(envPath, {
				CLIENT_ID: clientId,
				CLIENT_SECRET: secretText,
				TENANT_ID: account.tenantId,
			}, "Credentials:");
		} catch (error) {
			spinner.error({ text: "Failed" });
			logger.error(
				error instanceof Error ? error.message : "Failed to create app",
			);
			process.exit(1);
		}
	});
