import { Command } from "commander";
import { login, getAccount } from "../../auth/index.js";

export const loginCommand = new Command("login")
  .description("Log in to Microsoft 365")
  .action(async () => {
    const existingAccount = await getAccount();

    if (existingAccount) {
      console.log(`Already logged in as ${existingAccount.username}`);
      console.log('Run "teams logout" first to switch accounts.');
      return;
    }

    try {
      const account = await login();
      console.log(`\nLogged in as ${account.username}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Login failed: ${error.message}`);
      } else {
        console.error("Login failed");
      }
      process.exit(1);
    }
  });
