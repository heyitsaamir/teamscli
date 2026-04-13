import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import { Command } from "commander";
import pc from "picocolors";
import { wrapAction, CliError } from "../../../utils/errors.js";
import { logger } from "../../../utils/logger.js";
import { outputJson } from "../../../utils/json-output.js";
import { scaffoldProject, listTemplates, listToolkits } from "../../../project/scaffold.js";
import { normalizePackageName, gatherEnvVars, type ProjectNewOutput } from "../shared.js";

interface ProjectNewTsOptions {
  template: string;
  toolkit?: string;
  clientId?: string;
  clientSecret?: string;
  start?: boolean;
  json?: boolean;
}

const templates = listTemplates("typescript");
const toolkits = listToolkits("typescript");

export const projectNewTypescriptCommand = new Command("typescript")
  .alias("ts")
  .description("Create a new TypeScript Teams app")
  .argument("<name>", "App name")
  .option(`-t, --template <template>`, `App template (${templates.join(", ")})`, "echo")
  .option(`--toolkit <toolkit>`, `[OPTIONAL] M365 Agents Toolkit config (${toolkits.join(", ")})`)
  .option("--client-id <id>", "[OPTIONAL] Azure app client ID")
  .option("--client-secret <secret>", "[OPTIONAL] Azure app client secret")
  .option("-s, --start", "[OPTIONAL] Auto-start project after creation")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(
    wrapAction(async (rawName: string, options: ProjectNewTsOptions) => {
      const name = normalizePackageName(rawName);

      if (!templates.includes(options.template)) {
        throw new CliError(
          "VALIDATION_FORMAT",
          `Unknown template "${options.template}".`,
          `Available templates: ${templates.join(", ")}`,
        );
      }

      if (options.toolkit && !toolkits.includes(options.toolkit)) {
        throw new CliError(
          "VALIDATION_FORMAT",
          `Unknown toolkit "${options.toolkit}".`,
          `Available toolkits: ${toolkits.join(", ")}`,
        );
      }

      if (!/^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(name)) {
        throw new CliError("VALIDATION_FORMAT", `"${name}" is not a valid package name.`);
      }

      const targetDir = path.join(process.cwd(), name);
      if (fs.existsSync(targetDir)) {
        throw new CliError("VALIDATION_CONFLICT", `"${name}" already exists.`);
      }

      const envVars = gatherEnvVars(options);

      await scaffoldProject({
        name,
        language: "typescript",
        template: options.template,
        targetDir,
        toolkit: options.toolkit,
        envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
      });

      if (options.json) {
        const output: ProjectNewOutput = {
          name,
          language: "typescript",
          template: options.template,
          toolkit: options.toolkit,
          path: targetDir,
        };
        outputJson(output);
        return;
      }

      logger.info(pc.bold(pc.green(`App "${name}" created successfully at ${targetDir}`)));

      if (options.start) {
        logger.info(`cd ${name} && npm install && npm run dev`);
        cp.spawnSync("npm", ["install"], { cwd: targetDir, stdio: "inherit" });
        cp.spawnSync("npm", ["run", "dev"], { cwd: targetDir, stdio: "inherit" });
      } else {
        logger.info("Next steps to start the app:");
        logger.info(`cd ${name} && npm install && npm run dev`);
      }
    }),
  );
