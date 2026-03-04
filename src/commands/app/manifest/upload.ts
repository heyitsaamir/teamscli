import { Command } from "commander";
import pc from "picocolors";
import { getAccount, getTokenSilent, teamsDevPortalScopes } from "../../../auth/index.js";
import { pickApp } from "../../../utils/app-picker.js";
import { uploadManifestFromFile } from "./actions.js";

export const manifestUploadCommand = new Command("upload")
  .description("Upload a manifest.json to update an existing Teams app")
  .argument("[appId]", "App ID")
  .argument("[file-path]", "Path to manifest.json file")
  .action(async (appIdArg: string | undefined, filePath: string | undefined, options) => {
    // Disambiguate: if only one arg and it looks like a file path, treat as filePath
    if (appIdArg && !filePath && (appIdArg.includes("/") || appIdArg.includes("\\") || appIdArg.endsWith(".json"))) {
      filePath = appIdArg;
      appIdArg = undefined;
    }

    // file-path is required for upload
    if (!filePath) {
      console.log(pc.red("Missing file path.") + ` Provide the path to manifest.json as an argument.`);
      process.exit(1);
    }

    let appId: string;
    let token: string;

    if (appIdArg) {
      const account = await getAccount();
      if (!account) {
        console.log(pc.red("Not logged in.") + ` Run ${pc.cyan("teams login")} first.`);
        process.exit(1);
      }

      token = (await getTokenSilent(teamsDevPortalScopes))!;
      if (!token) {
        console.log(pc.red("Failed to get token.") + ` Try ${pc.cyan("teams login")} again.`);
        process.exit(1);
      }
      appId = appIdArg;
    } else {
      const picked = await pickApp();
      appId = picked.app.teamsAppId;
      token = picked.token;
    }

    try {
      await uploadManifestFromFile(token, appId, filePath);
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
