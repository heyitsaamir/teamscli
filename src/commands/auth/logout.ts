import { Command } from "commander";
import { createSpinner } from "nanospinner";
import { logout, getAccount } from "../../auth/index.js";

export const logoutCommand = new Command("logout")
  .description("Log out of Microsoft 365")
  .action(async () => {
    const account = await getAccount();

    if (!account) {
      console.log("Not logged in.");
      return;
    }

    const spinner = createSpinner("Logging out...").start();
    await logout();
    spinner.success({ text: `Logged out of ${account.username}` });
  });
