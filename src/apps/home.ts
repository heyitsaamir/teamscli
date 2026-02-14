import { select } from "@inquirer/prompts";
import pc from "picocolors";
import type { AppSummary } from "./types.js";
import { formatDate } from "../utils/date.js";

export async function showAppHome(app: AppSummary, _token: string): Promise<void> {
  console.log(`\n${pc.bold(app.appName ?? "Unnamed")}`);
  console.log(`${pc.dim("ID:")} ${app.teamsAppId}`);
  console.log(`${pc.dim("Version:")} ${app.version ?? "N/A"}`);
  console.log(`${pc.dim("Updated:")} ${formatDate(app.updatedAt)}`);

  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "Edit name", value: "edit-name" },
      { name: "Edit endpoint", value: "edit-endpoint" },
      { name: "Download manifest", value: "download" },
      { name: "Back", value: "back" },
    ],
  });

  if (action === "back") {
    return;
  }

  // TODO: Implement actions
  console.log(pc.dim(`\n"${action}" not implemented yet.`));
}
