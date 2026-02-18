import { Command } from "commander";
import { createSpinner } from "nanospinner";
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

    const spinner = createSpinner("Authenticating...").start();
    try {
      const account = await login();
      spinner.success({ text: `Logged in as ${account.username}` });
    } catch (error) {
      spinner.error({ text: "Login failed" });
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
    }
  });
