import { Command } from "commander";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { pickApp } from "../../../utils/app-picker.js";
import { CliError, wrapAction } from "../../../utils/errors.js";
import { outputJson } from "../../../utils/json-output.js";
import { uploadManifestFromFile } from "./actions.js";

interface ManifestUploadOutput {
  teamsAppId: string;
  filePath: string;
}

export const manifestUploadCommand = new Command("upload")
  .description("Upload a manifest.json to update an existing Teams app")
  .argument("<file-path>", "Path to manifest.json file")
  .argument("[appId]", "Teams app ID (prompted if not provided)")
  .option("--json", "[OPTIONAL] Output result as JSON")
  .action(wrapAction(async (filePathArg: string, appIdArg: string | undefined, options: { json?: boolean }) => {
    let teamsAppId: string;
    let token: string;

    if (appIdArg) {
      const account = await getAccount();
      if (!account) {
        throw new CliError("AUTH_REQUIRED", "Not logged in.", "Run `teams login` first.");
      }

      token = (await getTokenSilent(teamsDevPortalScopes))!;
      if (!token) {
        throw new CliError("AUTH_TOKEN_FAILED", "Failed to get token.", "Try `teams login` again.");
      }
      teamsAppId = appIdArg;
    } else {
      const picked = await pickApp();
      teamsAppId = picked.app.teamsAppId;
      token = picked.token;
    }

    await uploadManifestFromFile(token, teamsAppId, filePathArg);

    if (options.json) {
      outputJson({ teamsAppId, filePath: filePathArg } satisfies ManifestUploadOutput);
    }
  }));
