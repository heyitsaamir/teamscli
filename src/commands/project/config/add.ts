import { Command } from "commander";
import pc from "picocolors";
import { wrapAction, CliError } from "../../../utils/errors.js";
import { logger } from "../../../utils/logger.js";
import { outputJson } from "../../../utils/json-output.js";
import { addToolkitConfig, detectLanguage } from "../../../project/scaffold.js";
import { parseToolkitName } from "../shared.js";

interface ConfigAddOptions {
  json?: boolean;
}

interface ConfigAddOutput {
  toolkit: string;
  language: string;
  path: string;
}

export const projectConfigAddCommand = new Command("add")
  .description("Add Agents Toolkit configuration to the current project")
  .argument("<name>", "Config name (e.g. atk.basic, atk.oauth, atk.embed)")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(
    wrapAction(async (name: string, options: ConfigAddOptions) => {
      const language = detectLanguage();
      if (!language) {
        throw new CliError(
          "VALIDATION_MISSING",
          "Could not detect project language.",
          "Are you in the right folder? Expected a package.json (TypeScript), .sln (C#), or pyproject.toml (Python).",
        );
      }

      const toolkit = parseToolkitName(name, language);

      await addToolkitConfig({
        language,
        toolkit,
        targetDir: process.cwd(),
      });

      if (options.json) {
        const output: ConfigAddOutput = {
          toolkit: name,
          language,
          path: process.cwd(),
        };
        outputJson(output);
        return;
      }

      logger.info(pc.bold(pc.green(`config "${name}" successfully added`)));
    }),
  );
