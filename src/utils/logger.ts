import pc from "picocolors";
import { logToSession, argsToString } from "./session-log.js";

let verbose = false;

export function setVerbose(value: boolean): void {
  verbose = value;
}

export function isVerbose(): boolean {
  return verbose;
}

export const logger = {
  debug: (...args: unknown[]) => {
    // Always write debug entries to the session log, even when not in verbose mode,
    // so support staff can see full diagnostic output without asking users to re-run.
    logToSession("DEBUG", argsToString(args));
    if (verbose) {
      console.debug(pc.dim("[debug]"), ...args);
    }
  },
  info: (...args: unknown[]) => {
    logToSession("INFO", argsToString(args));
    console.log(...args);
  },
  warn: (...args: unknown[]) => {
    logToSession("WARN", argsToString(args));
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    logToSession("ERROR", argsToString(args));
    console.error(...args);
  },
};
