import fs from "node:fs";
import path from "node:path";
import { pascalCase } from "change-case";
import { templatesDir, configsDir } from "./paths.js";
import { copyDir, renderTemplate, type CopyContext } from "./copy.js";
import { setJsonValue, setYamlValue, setEnvVar, updateFile } from "./file-ops.js";

export type ProjectLanguage = "typescript" | "csharp" | "python";

export interface ScaffoldOptions {
  name: string;
  language: ProjectLanguage;
  template: string;
  targetDir: string;
  toolkit?: string;
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
 * List available toolkit configurations for a given language.
 */
export function listToolkits(language: ProjectLanguage): string[] {
  const atkDir = path.join(configsDir, "atk");
  if (!fs.existsSync(atkDir)) return [];
  return fs
    .readdirSync(atkDir)
    .filter((type) => fs.existsSync(path.join(atkDir, type, language)));
}

/**
 * Create a new project from a template.
 */
export async function scaffoldProject(opts: ScaffoldOptions): Promise<void> {
  const { name, language, template, targetDir, toolkit, envVars } = opts;
  const templateDir = path.join(templatesDir, language, template);

  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template "${template}" not found for ${language}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const context: CopyContext = { name, language };
  await copyDir(templateDir, targetDir, context);

  if (toolkit) {
    await applyToolkit(language, toolkit, targetDir, context);
  }

  if (envVars && Object.keys(envVars).length > 0) {
    writeEnvVars(language, targetDir, name, envVars);
  }
}

/**
 * Add a toolkit configuration to an existing project.
 */
export async function addToolkitConfig(opts: {
  language: ProjectLanguage;
  toolkit: string;
  targetDir: string;
}): Promise<void> {
  const context: CopyContext = {
    name: path.basename(opts.targetDir),
    language: opts.language,
  };
  await applyToolkit(opts.language, opts.toolkit, opts.targetDir, context);
}

/**
 * Remove a toolkit configuration from an existing project.
 */
export async function removeToolkitConfig(opts: {
  language: ProjectLanguage;
  toolkit: string;
  targetDir: string;
}): Promise<void> {
  const { language, toolkit, targetDir } = opts;
  const configDir = path.join(configsDir, "atk", toolkit, language);

  if (!fs.existsSync(configDir)) {
    throw new Error(`Toolkit config "${toolkit}" not found for ${language}`);
  }

  const context: CopyContext = {
    name: path.basename(targetDir),
    language,
  };

  // Check that at least one config file exists in the project before removing
  if (!hasConfigFiles(configDir, targetDir, context)) {
    throw new Error(`Config "${toolkit}" is not applied to this project.`);
  }

  // Remove files that were copied from the config
  removeConfigFiles(configDir, targetDir, context);

  // Revert language-specific file modifications
  if (language === "typescript") {
    revertTypescriptToolkit(targetDir);
  } else if (language === "csharp") {
    revertCsharpToolkit(targetDir);
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

async function applyToolkit(
  language: ProjectLanguage,
  toolkit: string,
  targetDir: string,
  context: CopyContext,
): Promise<void> {
  const configDir = path.join(configsDir, "atk", toolkit, language);

  if (!fs.existsSync(configDir)) {
    throw new Error(`Toolkit config "${toolkit}" not found for ${language}`);
  }

  await copyDir(configDir, targetDir, context);

  if (language === "typescript") {
    applyTypescriptToolkit(targetDir);
  } else if (language === "csharp") {
    applyCsharpToolkit(targetDir);
  }
  // Python: just the file copy, no extra modifications
}

function applyTypescriptToolkit(targetDir: string): void {
  const pkgPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(pkgPath)) return;

  setJsonValue(pkgPath, "devDependencies.env-cmd", "latest");
  setJsonValue(
    pkgPath,
    "scripts.dev:teamsfx",
    "npx cross-env NODE_OPTIONS='--inspect=9239' npx env-cmd -f .env npm run dev",
  );
  setJsonValue(
    pkgPath,
    "scripts.dev:teamsfx:testtool",
    "npx cross-env NODE_OPTIONS='--inspect=9239' npx env-cmd -f .env npm run dev",
  );
  setJsonValue(
    pkgPath,
    "scripts.dev:teamsfx:launch-testtool",
    "npx env-cmd --silent -f env/.env.testtool teamsapptester start",
  );

  // Vite project support
  const hasVite =
    fs.existsSync(path.join(targetDir, "vite.config.js")) ||
    fs.existsSync(path.join(targetDir, "vite.config.ts"));

  if (hasVite) {
    const yamlPath = path.join(targetDir, "teamsapp.local.yml");
    if (fs.existsSync(yamlPath)) {
      setYamlValue(yamlPath, "deploy.1.with.envs.VITE_CLIENT_ID", "${{BOT_ID}}");
      setYamlValue(yamlPath, "deploy.1.with.envs.VITE_CLIENT_SECRET", "${{SECRET_BOT_PASSWORD}}");
      setYamlValue(yamlPath, "deploy.1.with.envs.VITE_TENANT_ID", "${{AAD_APP_TENANT_ID}}");
    }
  }
}

function applyCsharpToolkit(targetDir: string): void {
  // Find .sln file
  const slnFile = fs.readdirSync(targetDir).find((f) => f.endsWith(".sln"));
  if (!slnFile) throw new Error("No .sln file found in the target directory");

  const slnName = path.basename(slnFile, ".sln");

  // Find or create .slnlaunch.user
  let launchFile = fs.readdirSync(targetDir).find((f) => f.endsWith(".slnlaunch.user"));
  if (!launchFile) {
    launchFile = `${slnName}.slnlaunch.user`;
    fs.writeFileSync(path.join(targetDir, launchFile), JSON.stringify([], null, 2));
  }

  // Update .slnlaunch.user with debug profiles
  updateFile(path.join(targetDir, launchFile), (content) => {
    const jsonArray = JSON.parse(content) as unknown[];
    jsonArray.push(
      {
        Name: "Microsoft Teams (browser)",
        Projects: [
          {
            Path: "TeamsApp\\TeamsApp.ttkproj",
            Action: "StartWithoutDebugging",
            DebugTarget: "Microsoft Teams (browser)",
          },
          {
            Path: `${slnName}\\${slnName}.csproj`,
            Action: "Start",
            DebugTarget: "Start Project",
          },
        ],
      },
      {
        Name: "Microsoft Teams (browser) (skip update Teams App)",
        Projects: [
          {
            Path: "TeamsApp\\TeamsApp.ttkproj",
            Action: "StartWithoutDebugging",
            DebugTarget: "Microsoft Teams (browser) (skip update Teams App)",
          },
          {
            Path: `${slnName}\\${slnName}.csproj`,
            Action: "Start",
            DebugTarget: "Start Project",
          },
        ],
      },
    );
    return JSON.stringify(jsonArray, null, 2);
  });

  // Update .sln with TeamsApp project reference
  updateFile(path.join(targetDir, slnFile), (content) => {
    const lines = content.split(/\r?\n/);
    const insertIndex = lines.findIndex((line) => line.trim().startsWith("Global"));

    if (insertIndex === -1) {
      throw new Error("Global section not found in .sln");
    }

    const projectTypeGuid = "{GAE04EC0-301F-11D3-BF4B-00C04F79EFBD}";
    const projectInstanceGuid = "{HAJ04EC0-301F-11D3-BF4B-00C04F79EFCE}";

    lines.splice(
      insertIndex,
      0,
      `Project("${projectTypeGuid}") = "TeamsApp", "TeamsApp\\TeamsApp.ttkproj", "${projectInstanceGuid}"`,
      "EndProject",
    );

    return lines.join("\r\n");
  });
}

function revertTypescriptToolkit(targetDir: string): void {
  const pkgPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(pkgPath)) return;

  setJsonValue(pkgPath, "devDependencies.env-cmd");
  setJsonValue(pkgPath, "scripts.dev:teamsfx");
  setJsonValue(pkgPath, "scripts.dev:teamsfx:testtool");
  setJsonValue(pkgPath, "scripts.dev:teamsfx:launch-testtool");
}

function revertCsharpToolkit(targetDir: string): void {
  // Remove TeamsApp reference from .sln
  const slnFile = fs.readdirSync(targetDir).find((f) => f.endsWith(".sln"));
  if (slnFile) {
    updateFile(path.join(targetDir, slnFile), (content) => {
      const lines = content.split(/\r?\n/);
      const projIdx = lines.findIndex((l) => l.includes("TeamsApp\\TeamsApp.ttkproj"));
      if (projIdx !== -1) {
        const endIdx = lines.indexOf("EndProject", projIdx);
        lines.splice(projIdx, endIdx !== -1 ? endIdx - projIdx + 1 : 2);
      }
      return lines.join("\r\n");
    });
  }

  // Remove debug profiles from .slnlaunch.user
  const launchFile = fs.readdirSync(targetDir).find((f) => f.endsWith(".slnlaunch.user"));
  if (launchFile) {
    updateFile(path.join(targetDir, launchFile), (content) => {
      const jsonArray = JSON.parse(content) as Array<{ Projects?: Array<{ Path?: string }> }>;
      const filtered = jsonArray.filter(
        (item) => !item.Projects?.some((p) => p.Path?.includes("TeamsApp")),
      );
      return JSON.stringify(filtered, null, 2);
    });
  }
}

/**
 * Check if any files from a config directory exist in the target project.
 */
function hasConfigFiles(configDir: string, targetDir: string, context: CopyContext): boolean {
  const items = fs.readdirSync(configDir);
  for (const item of items) {
    const configPath = path.join(configDir, item);
    let targetName = item;
    if (item.endsWith(".hbs")) {
      targetName = renderTemplate(item, context).replace(/\.hbs$/, "");
    }
    const targetPath = path.join(targetDir, targetName);

    if (fs.statSync(configPath).isDirectory()) {
      if (fs.existsSync(targetPath) && hasConfigFiles(configPath, targetPath, context)) {
        return true;
      }
    } else if (fs.existsSync(targetPath)) {
      return true;
    }
  }
  return false;
}

function removeConfigFiles(configDir: string, targetDir: string, context: CopyContext): void {
  const items = fs.readdirSync(configDir);
  for (const item of items) {
    const configPath = path.join(configDir, item);
    // Render Handlebars names and strip .hbs — matches what copyDir produces
    let targetName = item;
    if (item.endsWith(".hbs")) {
      targetName = renderTemplate(item, context).replace(/\.hbs$/, "");
    }
    const targetPath = path.join(targetDir, targetName);

    if (fs.statSync(configPath).isDirectory()) {
      if (fs.existsSync(targetPath)) {
        removeConfigFiles(configPath, targetPath, context);
        // Remove dir if empty
        if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length === 0) {
          fs.rmdirSync(targetPath);
        }
      }
    } else if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }
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
