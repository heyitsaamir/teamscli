/**
 * Check whether the session is interactive (can show prompts).
 * Returns false when stdin is not a TTY or TEAMS_NO_INTERACTIVE is set.
 */
export function isInteractive(): boolean {
  if (process.env.TEAMS_NO_INTERACTIVE) return false;
  return !!process.stdin.isTTY;
}
