import { Command } from "commander";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import { getAccount, getTokenSilent, teamsDevPortalScopes, graphScopes } from "../../auth/index.js";
import { fetchAppDetailsV2, getAadAppByClientId, getAadAppFull, fetchBot, getBotLocation, discoverAzureBot, extractDomain } from "../../apps/index.js";
import type { AppDetails } from "../../apps/types.js";
import type { BotDetails } from "../../apps/tdp.js";
import type { BotLocation } from "../../apps/bot-location.js";
import type { AzureContext } from "../../apps/bot-handler.js";
import { isAzInstalled, isAzLoggedIn, runAz } from "../../utils/az.js";
import { pickApp } from "../../utils/app-picker.js";
import { logger } from "../../utils/logger.js";

type CheckStatus = "pass" | "fail" | "warn" | "info";

interface CheckResult {
  category: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

const STATUS_ICONS: Record<CheckStatus, string> = {
  pass: pc.green("✔"),
  fail: pc.red("✗"),
  warn: pc.yellow("⚠"),
  info: pc.blue("ℹ"),
};

function printResults(results: CheckResult[]): void {
  for (const r of results) {
    const icon = STATUS_ICONS[r.status];
    const detail = r.detail ? ` ${pc.dim(`(${r.detail})`)}` : "";
    console.log(`  ${icon} ${r.label}${detail}`);
  }
}

function printSummary(allResults: CheckResult[]): void {
  const issues = allResults.filter((r) => r.status === "fail").length;
  const warnings = allResults.filter((r) => r.status === "warn").length;

  console.log();
  if (issues === 0 && warnings === 0) {
    console.log(pc.green("No issues found."));
  } else {
    const parts: string[] = [];
    if (issues > 0) parts.push(pc.red(`${issues} issue${issues > 1 ? "s" : ""}`));
    if (warnings > 0) parts.push(pc.yellow(`${warnings} warning${warnings > 1 ? "s" : ""}`));
    console.log(`${parts.join(", ")} found.`);
  }
}

async function checkEndpointReachable(endpoint: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(endpoint, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    // Any response (even 4xx) means endpoint is reachable
    return response.status < 500;
  } catch {
    // Try GET as fallback (some servers reject HEAD)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(endpoint, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);
      return response.status < 500;
    } catch {
      return false;
    }
  }
}

// --- Bot Registration checks ---

async function checkBotRegistration(
  results: CheckResult[],
  details: AppDetails,
  tdpToken: string,
): Promise<{ botId: string; location: BotLocation; bfBot: BotDetails | null; azure: AzureContext | null } | null> {
  const cat = "Bot Registration";

  if (!details.bots || details.bots.length === 0) {
    results.push({ category: cat, label: "No bot registered", status: "info" });
    return null;
  }

  const botId = details.bots[0].botId;
  results.push({ category: cat, label: "Bot registered", status: "pass", detail: botId });

  // Detect location
  let location: BotLocation;
  try {
    location = await getBotLocation(tdpToken, botId);
    results.push({ category: cat, label: `Bot location: ${location === "bf" ? "BF tenant" : "Azure"}`, status: "pass" });
  } catch (e) {
    results.push({ category: cat, label: "Could not detect bot location", status: "fail", detail: e instanceof Error ? e.message : undefined });
    return null;
  }

  let bfBot: BotDetails | null = null;
  let azure: AzureContext | null = null;

  if (location === "bf") {
    // BF-specific checks
    try {
      bfBot = await fetchBot(tdpToken, botId);
      results.push({ category: cat, label: "BF bot details fetchable", status: "pass" });

      // Teams channel
      if (bfBot.configuredChannels?.includes("msteams")) {
        results.push({ category: cat, label: "Teams channel enabled", status: "pass" });
      } else {
        results.push({ category: cat, label: "Teams channel not enabled", status: "fail", detail: "Add msteams to configuredChannels" });
      }

      // Endpoint
      if (bfBot.messagingEndpoint) {
        results.push({ category: cat, label: `Endpoint: ${bfBot.messagingEndpoint}`, status: "pass" });
        const reachable = await checkEndpointReachable(bfBot.messagingEndpoint);
        if (reachable) {
          results.push({ category: cat, label: "Endpoint reachable", status: "pass" });
        } else {
          results.push({ category: cat, label: "Endpoint unreachable", status: "warn", detail: "timeout or network error" });
        }
      } else {
        results.push({ category: cat, label: "Messaging endpoint not set", status: "warn" });
      }
    } catch (e) {
      results.push({ category: cat, label: "Could not fetch BF bot details", status: "fail", detail: e instanceof Error ? e.message : undefined });
    }
  } else {
    // Azure-specific checks
    if (!isAzInstalled()) {
      results.push({ category: cat, label: "Azure CLI not installed", status: "warn", detail: "Install from https://aka.ms/install-az" });
    } else if (!isAzLoggedIn()) {
      results.push({ category: cat, label: "Azure CLI not logged in", status: "warn", detail: "Run az login" });
    } else {
      azure = discoverAzureBot(botId);
      if (azure) {
        results.push({ category: cat, label: "Azure bot discoverable", status: "pass", detail: azure.resourceGroup });

        // Check Teams channel + endpoint via az bot show
        try {
          const azBot = runAz<{ properties?: { endpoint?: string } }>([
            "bot", "show",
            "--name", botId,
            "--resource-group", azure.resourceGroup,
            "--subscription", azure.subscription,
          ]);

          // Check Teams channel
          try {
            runAz([
              "bot", "msteams", "show",
              "--name", botId,
              "--resource-group", azure.resourceGroup,
              "--subscription", azure.subscription,
            ]);
            results.push({ category: cat, label: "Teams channel enabled", status: "pass" });
          } catch {
            results.push({ category: cat, label: "Teams channel not enabled", status: "fail", detail: "Run: az bot msteams create" });
          }

          // Endpoint
          const endpoint = azBot?.properties?.endpoint;
          if (endpoint) {
            results.push({ category: cat, label: `Endpoint: ${endpoint}`, status: "pass" });
            const reachable = await checkEndpointReachable(endpoint);
            if (reachable) {
              results.push({ category: cat, label: "Endpoint reachable", status: "pass" });
            } else {
              results.push({ category: cat, label: "Endpoint unreachable", status: "warn", detail: "timeout or network error" });
            }
          } else {
            results.push({ category: cat, label: "Messaging endpoint not set", status: "warn" });
          }
        } catch (e) {
          results.push({ category: cat, label: "Could not fetch Azure bot details", status: "fail", detail: e instanceof Error ? e.message : undefined });
        }
      } else {
        results.push({ category: cat, label: "Azure bot not found", status: "fail", detail: "Bot not discoverable via az resource list" });
      }
    }
  }

  return { botId, location, bfBot, azure };
}

// --- AAD App checks ---

async function checkAadApp(
  results: CheckResult[],
  botId: string,
  graphToken: string,
): Promise<Record<string, unknown> | null> {
  const cat = "AAD App";

  let aadApp;
  try {
    aadApp = await getAadAppByClientId(graphToken, botId);
    results.push({ category: cat, label: `AAD app found`, status: "pass", detail: aadApp.appId });
  } catch {
    results.push({ category: cat, label: "AAD app not found", status: "fail", detail: `No app with clientId ${botId}` });
    return null;
  }

  // Get full details for password + audience checks
  let fullApp: Record<string, unknown>;
  try {
    fullApp = await getAadAppFull(graphToken, aadApp.id);
  } catch (e) {
    results.push({ category: cat, label: "Could not fetch full AAD app details", status: "warn", detail: e instanceof Error ? e.message : undefined });
    return null;
  }

  // Check secrets
  const creds = (fullApp.passwordCredentials ?? []) as Array<{ endDateTime?: string; displayName?: string }>;
  if (creds.length === 0) {
    results.push({ category: cat, label: "No client secrets", status: "warn", detail: "Run: teams app auth secret generate" });
  } else {
    const now = new Date();
    const active = creds.filter((c) => !c.endDateTime || new Date(c.endDateTime) > now);
    const expired = creds.length - active.length;

    if (active.length > 0) {
      const nearest = active
        .filter((c) => c.endDateTime)
        .sort((a, b) => new Date(a.endDateTime!).getTime() - new Date(b.endDateTime!).getTime());
      const expiryInfo = nearest.length > 0
        ? `nearest expiry: ${new Date(nearest[0].endDateTime!).toLocaleDateString()}`
        : "no expiry";
      results.push({ category: cat, label: `${active.length} active secret${active.length > 1 ? "s" : ""}`, status: "pass", detail: expiryInfo });
    }

    if (expired > 0) {
      results.push({ category: cat, label: `${expired} expired secret${expired > 1 ? "s" : ""}`, status: active.length === 0 ? "fail" : "warn" });
    }
  }

  // Sign-in audience
  const audience = fullApp.signInAudience as string | undefined;
  if (audience) {
    results.push({ category: cat, label: `Sign-in audience: ${audience}`, status: "info" });
  }

  return fullApp;
}

// --- Manifest checks ---

function checkManifest(
  results: CheckResult[],
  details: AppDetails,
  botId: string,
  endpoint?: string,
): void {
  const cat = "Manifest";

  // botId matches appId
  if (details.appId === botId) {
    results.push({ category: cat, label: "Bot ID matches app ID", status: "pass" });
  } else {
    results.push({ category: cat, label: "Bot ID does not match app ID", status: "warn", detail: `appId=${details.appId}, botId=${botId}` });
  }

  // validDomains includes endpoint domain
  if (endpoint) {
    const domain = extractDomain(endpoint);
    const validDomains = (details.validDomains ?? []) as string[];
    if (domain && validDomains.includes(domain)) {
      results.push({ category: cat, label: "Endpoint domain in validDomains", status: "pass" });
    } else if (domain) {
      results.push({ category: cat, label: "Endpoint domain not in validDomains", status: "warn", detail: `Add ${domain}` });
    }
  }

  // webApplicationInfo
  const wai = details.webApplicationInfoId;
  if (wai) {
    results.push({ category: cat, label: "webApplicationInfo configured", status: "pass" });

    // Check resource URI format
    const resource = details.webApplicationInfoResource as string | undefined;
    if (resource) {
      const expected = `api://botid-${botId}`;
      if (resource.startsWith(expected)) {
        results.push({ category: cat, label: `Resource URI: ${resource}`, status: "pass" });
      } else {
        results.push({ category: cat, label: `Resource URI format`, status: "warn", detail: `Expected ${expected}, got ${resource}` });
      }
    }
  } else {
    results.push({ category: cat, label: "webApplicationInfo not configured", status: "info", detail: "SSO not set up" });
  }
}

// --- SSO checks ---

async function checkSso(
  results: CheckResult[],
  details: AppDetails,
  botId: string,
  fullAadApp: Record<string, unknown>,
  azure: AzureContext | null,
): Promise<void> {
  const cat = "SSO";

  // Identifier URI
  const identifierUris = (fullAadApp.identifierUris ?? []) as string[];
  const expectedUri = `api://botid-${botId}`;
  const hasCorrectUri = identifierUris.some((u) => u.startsWith(expectedUri));

  if (hasCorrectUri) {
    results.push({ category: cat, label: `Identifier URI: ${expectedUri}`, status: "pass" });
  } else if (identifierUris.length > 0) {
    results.push({ category: cat, label: "Identifier URI format", status: "fail", detail: `Expected ${expectedUri}, got ${identifierUris[0]}` });
  } else {
    results.push({ category: cat, label: "No identifier URI set", status: "fail", detail: `Should be ${expectedUri}` });
  }

  // access_as_user scope
  const api = fullAadApp.api as { oauth2PermissionScopes?: Array<{ value?: string }> } | undefined;
  const scopes = api?.oauth2PermissionScopes ?? [];
  const hasAccessAsUser = scopes.some((s) => s.value === "access_as_user");
  if (hasAccessAsUser) {
    results.push({ category: cat, label: "access_as_user scope", status: "pass" });
  } else {
    results.push({ category: cat, label: "access_as_user scope missing", status: "fail" });
  }

  // Pre-authorized clients
  const preAuthorized = (api as { preAuthorizedApplications?: Array<{ appId?: string }> })
    ?.preAuthorizedApplications ?? [];
  const preAuthIds = preAuthorized.map((p) => p.appId);
  const teamsDesktop = "1fec8e78-bce4-4aaf-ab1b-5451cc387264";
  const teamsWeb = "5e3ce6c0-2b1f-4285-8d4b-75ee78787346";

  const hasDesktop = preAuthIds.includes(teamsDesktop);
  const hasWeb = preAuthIds.includes(teamsWeb);

  if (hasDesktop && hasWeb) {
    results.push({ category: cat, label: "Teams clients pre-authorized", status: "pass" });
  } else {
    const missing: string[] = [];
    if (!hasDesktop) missing.push("desktop");
    if (!hasWeb) missing.push("web");
    results.push({ category: cat, label: "Teams clients not pre-authorized", status: "fail", detail: `Missing: ${missing.join(", ")}` });
  }

  // BF redirect URI
  const web = fullAadApp.web as { redirectUris?: string[] } | undefined;
  const redirectUris = web?.redirectUris ?? [];
  const bfRedirect = "https://token.botframework.com/.auth/web/redirect";
  if (redirectUris.includes(bfRedirect)) {
    results.push({ category: cat, label: "BF redirect URI present", status: "pass" });
  } else {
    results.push({ category: cat, label: "BF redirect URI missing", status: "fail", detail: bfRedirect });
  }

  // OAuth connection check (Azure only)
  if (azure) {
    try {
      interface AuthSetting {
        name: string;
        properties?: {
          serviceProviderDisplayName?: string;
          parameters?: Array<{ key: string; value: string }>;
        };
      }

      const settings = runAz<AuthSetting[]>([
        "bot", "authsetting", "list",
        "--name", botId,
        "--resource-group", azure.resourceGroup,
        "--subscription", azure.subscription,
      ]);

      const aadConnections = settings.filter((s) => {
        const provider = s.properties?.serviceProviderDisplayName ?? "";
        return provider.includes("Azure Active Directory");
      });

      if (aadConnections.length === 0) {
        results.push({ category: cat, label: "No OAuth connection found", status: "warn", detail: "No AAD connection configured on Azure bot" });
      } else {
        for (const conn of aadConnections) {
          const connName = conn.name.split("/").pop() ?? conn.name;

          // List endpoint returns parameters: null — fetch full details via show
          const fullConn = runAz<AuthSetting>([
            "bot", "authsetting", "show",
            "--name", botId,
            "--resource-group", azure.resourceGroup,
            "--subscription", azure.subscription,
            "--setting-name", connName,
          ]);

          const params = fullConn.properties?.parameters ?? [];
          const tokenExchange = params.find((p) => p.key === "tokenExchangeUrl")?.value;

          if (tokenExchange) {
            const manifestResource = (details.webApplicationInfoResource as string | undefined) ?? "";
            const aadIdentifier = identifierUris[0] ?? "";

            const allMatch = tokenExchange === aadIdentifier && tokenExchange === manifestResource;
            if (allMatch) {
              results.push({ category: cat, label: `OAuth "${connName}" — URIs aligned`, status: "pass" });
            } else {
              results.push({ category: cat, label: `OAuth "${connName}" — URI mismatch`, status: "fail", detail: "tokenExchangeUrl, identifier URI, and manifest resource should match" });
              logger.debug(`  tokenExchangeUrl: ${tokenExchange}`);
              logger.debug(`  AAD identifier:   ${aadIdentifier}`);
              logger.debug(`  manifest resource: ${manifestResource}`);
            }
          } else {
            results.push({ category: cat, label: `OAuth "${connName}" — no tokenExchangeUrl`, status: "warn" });
          }
        }
      }
    } catch (e) {
      results.push({ category: cat, label: "Could not check OAuth connections", status: "warn", detail: e instanceof Error ? e.message : undefined });
    }
  }
}

// --- Main command ---

async function runDoctor(appIdArg: string | undefined): Promise<void> {
  const account = await getAccount();
  if (!account) {
    console.log(pc.red("Not logged in.") + ` Run ${pc.cyan("teams login")} first.`);
    process.exit(1);
  }

  let tdpToken: string;
  let appId: string;

  if (appIdArg) {
    tdpToken = (await getTokenSilent(teamsDevPortalScopes))!;
    if (!tdpToken) {
      console.log(pc.red("Failed to get token.") + ` Try ${pc.cyan("teams login")} again.`);
      process.exit(1);
    }
    appId = appIdArg;
  } else {
    const picked = await pickApp();
    tdpToken = picked.token;
    appId = picked.app.teamsAppId;
  }

  const spinner = createSpinner("Fetching app details...").start();

  let details: AppDetails;
  try {
    details = await fetchAppDetailsV2(tdpToken, appId);
  } catch (e) {
    spinner.error({ text: "Failed to fetch app details" });
    console.log(pc.red(e instanceof Error ? e.message : "Unknown error"));
    process.exit(1);
  }

  spinner.stop();

  const appName = details.shortName || details.appId;
  console.log(`\nDiagnosing: ${pc.bold(appName)} ${pc.dim(`(${details.appId})`)}`);

  const allResults: CheckResult[] = [];

  // 1. Bot Registration
  spinner.update({ text: "Checking bot registration..." }).start();
  const botResults: CheckResult[] = [];
  const botInfo = await checkBotRegistration(botResults, details, tdpToken);
  spinner.stop();
  console.log(`\n${pc.bold("Bot Registration")}`);
  printResults(botResults);
  allResults.push(...botResults);

  if (!botInfo) {
    printSummary(allResults);
    return;
  }

  const { botId, location, bfBot, azure } = botInfo;

  // 2. AAD App
  spinner.update({ text: "Checking AAD app..." }).start();
  let graphToken: string | null = null;
  try {
    graphToken = await getTokenSilent(graphScopes);
  } catch {
    // ignore
  }

  const aadResults: CheckResult[] = [];
  let fullAadApp: Record<string, unknown> | null = null;
  if (graphToken) {
    fullAadApp = await checkAadApp(aadResults, botId, graphToken);
  } else {
    aadResults.push({ category: "AAD App", label: "Could not get Graph token", status: "warn", detail: "Run teams login to grant Graph permissions" });
  }
  spinner.stop();
  console.log(`\n${pc.bold("AAD App")}`);
  printResults(aadResults);
  allResults.push(...aadResults);

  // 3. Manifest
  const manifestResults: CheckResult[] = [];
  const endpoint = location === "bf"
    ? bfBot?.messagingEndpoint
    : undefined;
  checkManifest(manifestResults, details, botId, endpoint);
  console.log(`\n${pc.bold("Manifest")}`);
  printResults(manifestResults);
  allResults.push(...manifestResults);

  // 4. SSO (only if webApplicationInfo configured)
  if (details.webApplicationInfoId && fullAadApp) {
    spinner.update({ text: "Checking SSO configuration..." }).start();
    const ssoResults: CheckResult[] = [];
    await checkSso(ssoResults, details, botId, fullAadApp, azure);
    spinner.stop();
    console.log(`\n${pc.bold("SSO")}`);
    printResults(ssoResults);
    allResults.push(...ssoResults);
  }

  printSummary(allResults);
}

export const appDoctorCommand = new Command("doctor")
  .description("Run diagnostic checks on a Teams app")
  .argument("[appId]", "App ID")
  .action(async (appIdArg: string | undefined) => {
    try {
      await runDoctor(appIdArg);
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        return;
      }
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
