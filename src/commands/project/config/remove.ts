import { Command } from "commander";
import pc from "picocolors";
import { wrapAction, CliError } from "../../../utils/errors.js";
import { logger } from "../../../utils/logger.js";
import { outputJson } from "../../../utils/json-output.js";
import { removeToolkitConfig, detectLanguage } from "../../../project/scaffold.js";
import { parseToolkitName } from "../shared.js";

interface ConfigRemoveOptions {
  json?: boolean;
}

interface ConfigRemoveOutput {
  toolkit: string;
  language: string;
  path: string;
}

export const projectConfigRemoveCommand = new Command("remove")
  .description("Remove Agents Toolkit configuration from the current project")
  .argument("<name>", "Config name (e.g. atk.basic, atk.oauth, atk.embed)")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(
    wrapAction(async (name: string, options: ConfigRemoveOptions) => {
      const language = detectLanguage();
      if (!language) {
        throw new CliError(
          "VALIDATION_MISSING",
          "Could not detect project language.",
          "Are you in the right folder? Expected a package.json (TypeScript), .sln (C#), or pyproject.toml (Python).",
        );
      }

      const toolkit = parseToolkitName(name, language);

      await removeToolkitConfig({
        language,
        toolkit,
        targetDir: process.cwd(),
      });

      if (options.json) {
        const output: ConfigRemoveOutput = {
          toolkit: name,
          language,
          path: process.cwd(),
        };
        outputJson(output);
        return;
      }

      logger.info(pc.bold(pc.green(`config "${name}" successfully removed`)));
    }),
  );
