import { input } from "@inquirer/prompts";
import { Command } from "commander";
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
	updateManifestBotId,
	createTdpBotHandler,
	createAzureBotHandler,
	type AzureContext,
	type BotLocation,
} from "../../apps/index.js";
import {
	getAccount,
	getTokenSilent,
	graphScopes,
	teamsDevPortalScopes,
} from "../../auth/index.js";
import { outputCredentials } from "../../utils/env.js";
import { CliError, wrapAction } from "../../utils/errors.js";
import { outputJson } from "../../utils/json-output.js";
import { logger } from "../../utils/logger.js";
import { isInteractive } from "../../utils/interactive.js";
import { getConfig } from "../../utils/config.js";
import { ensureAz, runAz } from "../../utils/az.js";
import { resolveSubscription, resolveResourceGroup } from "../../utils/az-prompts.js";
import { createSilentSpinner } from "../../utils/spinner.js";

interface AppCreateOutput {
	appName: string;
	teamsAppId: string;
	botId: string;
	endpoint: string | null;
	installLink: string;
	botLocation: "bf" | "azure";
	credentials: {
		CLIENT_ID: string;
		CLIENT_SECRET: string;
		TENANT_ID: string;
	};
}

interface CreateOptions {
	name?: string;
	endpoint?: string;
	manifest?: string;
	package?: string;
	env?: string;
	azure?: boolean;
	bf?: boolean;
	subscription?: string;
	resourceGroup?: string;
	createResourceGroup?: boolean;
	region?: string;
	json?: boolean;
}

export const appCreateCommand = new Command("create")
	.description("Create a new Teams app with bot")
	.option("-n, --name <name>", "App/bot name")
	.option("-e, --endpoint <url>", "[OPTIONAL] Bot messaging endpoint URL")
	.option("-m, --manifest <path>", "[OPTIONAL] Path to manifest.json")
	.option("-p, --package <path>", "[OPTIONAL] Path to app package zip")
	.option("--env <path>", "[OPTIONAL] Path to .env file to write credentials")
	.option("--azure", "[OPTIONAL] Create bot in Azure (requires az CLI)")
	.option("--bf", "[OPTIONAL] Create bot in BF tenant via TDP")
	.option("--subscription <id>", "[OPTIONAL] Azure subscription ID (defaults to az CLI default)")
	.option("--resource-group <name>", "Azure resource group (required for --azure)")
	.option("--create-resource-group", "[OPTIONAL] Create the resource group if it doesn't exist")
	.option("--region <name>", "[OPTIONAL] Azure region for resource group (default: westus2)")
	.option("--json", "[OPTIONAL] Output as JSON")
	.action(wrapAction(async (options: CreateOptions) => {
		const silent = !!options.json;
		const account = await getAccount();
		if (!account) {
			throw new CliError("AUTH_REQUIRED", "Not logged in.", "Run `teams login` first.");
		}

		// Validate options
		if (options.manifest && options.package) {
			throw new CliError("VALIDATION_CONFLICT", "Cannot specify both --manifest and --package.");
		}

		// Validate conflicting flags
		if (options.azure && options.bf) {
			throw new CliError("VALIDATION_CONFLICT", "Cannot specify both --azure and --bf.");
		}

		// Resolve bot location: explicit flag > config > default (bf)
		let location: BotLocation;
		if (options.azure) location = "azure";
		else if (options.bf) location = "bf";
		else location = ((await getConfig("default-bot-location")) as BotLocation) ?? "bf";

		// Gather Azure context if needed
		let azureContext: AzureContext | undefined;
		if (location === "azure") {
			ensureAz();
			const subscription = await resolveSubscription(options.subscription);
			const resourceGroup = await resolveResourceGroup(subscription, options.resourceGroup);

			if (options.createResourceGroup) {
				const rgRegion = options.region ?? "westus2";
				const rgSpinner = createSilentSpinner(`Creating resource group ${resourceGroup}...`, silent).start();
				runAz(["group", "create", "--name", resourceGroup, "--location", rgRegion, "--subscription", subscription]);
				rgSpinner.success({ text: `Resource group ${resourceGroup} ready` });
			}

			// Bot Service location is always "global"
			azureContext = { subscription, resourceGroup, region: "global", tenantId: account.tenantId };
		}

		// ===== Gather all inputs upfront =====
		const interactive = isInteractive();

		if (!interactive && !options.name && !options.package) {
			throw new CliError("VALIDATION_MISSING", "--name is required in non-interactive mode.");
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
			(interactive && !hasFlags && !options.json
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
		let spinner = createSilentSpinner("Acquiring tokens...", silent).start();

		const graphToken = await getTokenSilent(graphScopes);
		if (!graphToken) {
			spinner.error({ text: "Failed to get Graph token" });
			throw new CliError("AUTH_TOKEN_FAILED", "Failed to get Graph token.", "Try `teams login` again.");
		}

		const tdpToken = await getTokenSilent(teamsDevPortalScopes);
		if (!tdpToken) {
			spinner.error({ text: "Failed to get TDP token" });
			throw new CliError("AUTH_TOKEN_FAILED", "Failed to get TDP token.", "Try `teams login` again.");
		}
		spinner.success({ text: "Tokens acquired" });

		let clientId: string;
		let secretText: string;
		let zipBuffer: Buffer;
		let teamsAppId: string;

			if (options.package) {
				// Use existing package - read manifest to get bot ID
				spinner = createSilentSpinner("Reading package...", silent).start();
				zipBuffer = readZipFile(options.package);
				spinner.success({ text: "Package loaded" });

				// Create AAD app via TDP (creates service principal server-side)
				spinner = createSilentSpinner("Creating Azure AD app...", silent).start();
				const aadApp = await createAadAppViaTdp(tdpToken, name ?? "Bot");
				clientId = aadApp.appId;
				spinner.success({ text: `Created Azure AD app (${clientId})` });
			} else {
				// Create AAD app via TDP (creates service principal server-side)
				spinner = createSilentSpinner("Creating Azure AD app...", silent).start();
				const aadApp = await createAadAppViaTdp(tdpToken, name!);
				clientId = aadApp.appId;
				spinner.success({ text: `Created Azure AD app (${clientId})` });

				// Create zip from manifest or generate new one
				if (manifestPath) {
					spinner = createSilentSpinner("Processing manifest...", silent).start();
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
			spinner = createSilentSpinner("Generating client secret...", silent).start();
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
			spinner = createSilentSpinner("Creating Teams app...", silent).start();
			const importedApp = await importAppPackage(tdpToken, zipBuffer);
			teamsAppId = importedApp.teamsAppId;
			spinner.success({ text: `Created Teams app (${teamsAppId})` });

			// Register bot
			const locationLabel = location === "bf" ? "BF tenant" : "Azure";
			spinner = createSilentSpinner(`Registering bot (${locationLabel})...`, silent).start();
			const handler = location === "bf"
				? createTdpBotHandler(tdpToken)
				: createAzureBotHandler(azureContext!);
			await handler.createBot({ botId: clientId, name: name ?? "Bot", endpoint });
			spinner.success({ text: `Registered bot (${locationLabel})` });

			// Output results
			const installLink = `https://teams.microsoft.com/l/app/${teamsAppId}?installAppPackage=true`;

			if (options.json) {
				const result: AppCreateOutput = {
					appName: name ?? "Bot",
					teamsAppId,
					botId: clientId,
					endpoint: endpoint ?? null,
					installLink,
					botLocation: location,
					credentials: {
						CLIENT_ID: clientId,
						CLIENT_SECRET: secretText,
						TENANT_ID: account.tenantId,
					},
				};
				outputJson(result);
			} else {
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
			}
	}));
