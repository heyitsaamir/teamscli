import fs from "node:fs";
import path from "node:path";
import { kebabCase, capitalCase, pascalCase } from "change-case";
import { templatesDir, staticsDir } from "./paths.js";
import { copyDir, type CopyContext } from "./copy.js";
import { setJsonValue, setEnvVar } from "./file-ops.js";

export type ProjectLanguage = "typescript" | "csharp" | "python";

export interface ScaffoldOptions {
  name: string;
  language: ProjectLanguage;
  template: string;
  targetDir: string;
  envVars?: Record<string, string>;
}

/**
 * List available templates for a given language.
 */
export function listTemplates(language: ProjectLanguage): string[] {
  const dir = path.join(templatesDir, language);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory());
}

/**
 * Create a new project from a template.
 */
export async function scaffoldProject(opts: ScaffoldOptions): Promise<void> {
  const { name, language, template, targetDir, envVars } = opts;
  const templateDir = path.join(templatesDir, language, template);

  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template "${template}" not found for ${language}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const context: CopyContext = { name, language };
  await copyDir(templateDir, targetDir, context);

  generateAppPackage(targetDir, name, language, template);

  if (envVars && Object.keys(envVars).length > 0) {
    writeEnvVars(language, targetDir, name, envVars);
  }
}

/**
 * Detect the project language from files in a directory.
 */
export function detectLanguage(dir?: string): ProjectLanguage | undefined {
  const d = dir ?? process.cwd();
  if (fs.existsSync(path.join(d, "package.json"))) return "typescript";
  if (fs.readdirSync(d).some((file) => file.endsWith(".sln"))) return "csharp";
  if (fs.existsSync(path.join(d, "pyproject.toml"))) return "python";
  return undefined;
}

// --- internal helpers ---

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  "python/ai": "Sample Python bot that allows a user to interact with an LLM",
  "python/echo": "Sample Python bot that repeats back what you say",
  "python/graph": "Sample Python bot that uses MS Graph",
  "typescript/ai": "Sample bot that uses OpenAI",
  "typescript/echo": "Sample bot that repeats back what you say",
  "typescript/graph": "Sample bot that uses MS Graph",
  "typescript/mcp": "Sample bot that repeats back what you say",
  "typescript/mcpclient": "Sample agent that uses mcp servers to generate responses",
  "typescript/tab": "Sample bot with a tab",
};

interface StaticTab {
  entityId: string;
  name?: string;
  contentUrl?: string;
  websiteUrl?: string;
  scopes: string[];
}

function buildManifest(
  name: string,
  language: string,
  template: string,
): object {
  const key = `${language}/${template}`;
  const description = TEMPLATE_DESCRIPTIONS[key] ?? kebabCase(name);

  const staticTabs: StaticTab[] = [
    { entityId: "conversations", scopes: ["personal"] },
    { entityId: "about", scopes: ["personal"] },
  ];

  if (template === "tab") {
    staticTabs.push({
      entityId: "test",
      name: "Test",
      contentUrl: "https://${{BOT_DOMAIN}}/tabs/test",
      websiteUrl: "https://${{BOT_DOMAIN}}/tabs/test",
      scopes: ["personal", "team"],
    });
  }

  return {
    $schema:
      "https://developer.microsoft.com/json-schemas/teams/v1.25/MicrosoftTeams.schema.json",
    version: "1.0.0",
    manifestVersion: "1.25",
    id: "${{TEAMS_APP_ID}}",
    name: {
      short: `${kebabCase(name)}-$\{{APP_NAME_SUFFIX}}`,
      full: capitalCase(name),
    },
    developer: {
      name: "Microsoft",
      mpnId: "",
      websiteUrl: "https://microsoft.com",
      privacyUrl: "https://privacy.microsoft.com/privacystatement",
      termsOfUseUrl: "https://www.microsoft.com/legal/terms-of-use",
    },
    description: {
      short: description,
      full: description,
    },
    icons: {
      outline: "outline.png",
      color: "color.png",
    },
    accentColor: "#FFFFFF",
    staticTabs,
    bots: [
      {
        botId: "${{BOT_ID}}",
        scopes: ["personal", "team", "groupChat"],
        isNotificationOnly: false,
        supportsCalling: false,
        supportsVideo: false,
        supportsFiles: false,
      },
    ],
    validDomains: ["${{BOT_DOMAIN}}", "*.botframework.com"],
    webApplicationInfo: {
      id: "${{BOT_ID}}",
      resource: "api://botid-${{BOT_ID}}",
    },
    supportsChannelFeatures: "tier1",
  };
}

function generateAppPackage(
  targetDir: string,
  name: string,
  language: string,
  template: string,
): void {
  const appPackageDir = path.join(targetDir, "appPackage");
  fs.mkdirSync(appPackageDir, { recursive: true });

  fs.copyFileSync(
    path.join(staticsDir, "color.png"),
    path.join(appPackageDir, "color.png"),
  );
  fs.copyFileSync(
    path.join(staticsDir, "outline.png"),
    path.join(appPackageDir, "outline.png"),
  );

  const manifest = buildManifest(name, language, template);
  fs.writeFileSync(
    path.join(appPackageDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}

function writeEnvVars(
  language: ProjectLanguage,
  targetDir: string,
  projectName: string,
  envVars: Record<string, string>,
): void {
  if (language === "csharp") {
    // C# uses appsettings.Development.json with PascalCase keys
    const appSettingsPath = path.join(targetDir, projectName, "appsettings.Development.json");
    if (fs.existsSync(appSettingsPath)) {
      for (const [key, value] of Object.entries(envVars)) {
        const pascalKey = key
          .split(".")
          .map((part) => pascalCase(part))
          .join(".");
        setJsonValue(appSettingsPath, pascalKey, value);
      }
    }
  } else {
    // TypeScript and Python use .env
    const envPath = path.join(targetDir, ".env");
    for (const [key, value] of Object.entries(envVars)) {
      setEnvVar(envPath, key, value);
    }
  }
}
