import { Command } from "commander";
import { logout, getAccount } from "../../auth/index.js";

export const logoutCommand = new Command("logout")
  .description("Log out of Microsoft 365")
  .action(async () => {
    const account = await getAccount();

    if (!account) {
      console.log("Not logged in.");
      return;
    }

    await logout();
    console.log(`Logged out of ${account.username}`);
  });
