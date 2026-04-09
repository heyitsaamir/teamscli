import { confirm } from "@inquirer/prompts";

/**
 * Check whether the session is interactive (can show prompts).
 * Returns false when stdin is not a TTY or TEAMS_NO_INTERACTIVE is set.
 */
export function isInteractive(): boolean {
  if (process.env.TEAMS_NO_INTERACTIVE) return false;
  return !!process.stdin.isTTY;
}

let autoConfirm = false;

export function setAutoConfirm(value: boolean): void {
  autoConfirm = value;
}

export function isAutoConfirm(): boolean {
  return autoConfirm;
}

/**
 * Confirm a major action before proceeding.
 * - Returns true immediately when --yes is active.
 * - In interactive mode, prompts the user.
 * - In non-interactive mode without --yes, returns true (caller already
 *   provided explicit flags).
 */
export async function confirmAction(message: string, silent = false): Promise<boolean> {
  if (autoConfirm) return true;
  if (silent) return true;
  if (!isInteractive()) return true;
  return confirm({ message, default: true });
}
