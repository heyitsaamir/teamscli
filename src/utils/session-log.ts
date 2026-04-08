import { appendFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import envPaths from "env-paths";

const MAX_SESSION_FILES = 20;

// Compute paths independently to avoid a circular dependency:
//   logger.ts → session-log.ts → auth/config.ts → logger.ts
const sessionPaths = envPaths("teams-cli", { suffix: "" });

let sessionLogPath: string | null = null;
let sessionId: string | null = null;
let initialized = false;

function generateSessionId(): string {
  return randomBytes(4).toString("hex");
}

function timestamp(): string {
  return new Date().toISOString();
}

function formatEntry(level: string, message: string): string {
  return `[${timestamp()}] ${level.padEnd(5)} ${message}\n`;
}

/** Strip ANSI escape codes so log files contain plain text. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/** Convert unknown logger args to a plain, ANSI-free string. */
export function argsToString(args: unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? stripAnsi(a) : String(a)))
    .join(" ");
}

/** Sanitize argv by masking values that follow known sensitive flags. */
function sanitizeArgv(argv: string[]): string {
  const SENSITIVE_FLAGS = new Set([
    "--secret",
    "--client-secret",
    "--password",
    "--token",
    "--key",
  ]);
  const result: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eqIdx = arg.indexOf("=");
    if (eqIdx !== -1) {
      // Handle --flag=value format
      const flag = arg.slice(0, eqIdx).toLowerCase();
      if (SENSITIVE_FLAGS.has(flag)) {
        result.push(`${arg.slice(0, eqIdx)}=***`);
        continue;
      }
    } else if (SENSITIVE_FLAGS.has(arg.toLowerCase()) && i + 1 < argv.length) {
      result.push(arg, "***");
      i++;
      continue;
    }
    result.push(arg);
  }
  return result.join(" ");
}

/** Prune old session log files, keeping only the most recent MAX_SESSION_FILES. */
function pruneOldLogs(logDir: string): void {
  try {
    const files = readdirSync(logDir)
      .filter((f) => f.startsWith("teams-cli-") && f.endsWith(".log"))
      .map((f) => ({
        name: f,
        mtime: statSync(join(logDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of files.slice(MAX_SESSION_FILES)) {
      try {
        unlinkSync(join(logDir, file.name));
      } catch {
        // Best-effort
      }
    }
  } catch {
    // Best-effort
  }
}

/**
 * Initialize the session log. Creates a new log file for this invocation.
 * Call once at startup, before any logging.
 */
export function initSessionLog(): void {
  if (initialized) return;
  initialized = true;

  try {
    const logDir = sessionPaths.log;
    mkdirSync(logDir, { recursive: true });
    pruneOldLogs(logDir);

    sessionId = generateSessionId();
    // e.g. "2024-01-15T10-30-00"
    const safeDate = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const filename = `teams-cli-${safeDate}-${sessionId}.log`;
    sessionLogPath = join(logDir, filename);

    const command = sanitizeArgv(process.argv.slice(2));
    appendFileSync(
      sessionLogPath,
      formatEntry("START", `session=${sessionId} command="${command}"`)
    );

    process.on("exit", (code) => {
      if (sessionLogPath) {
        try {
          appendFileSync(sessionLogPath, formatEntry("END", `exit=${code}`));
        } catch {
          // Best-effort
        }
      }
    });
  } catch {
    // Never block the CLI
  }
}

/**
 * Write a timestamped entry to the current session log file.
 */
export function logToSession(
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CMD",
  message: string
): void {
  if (!sessionLogPath) return;
  try {
    appendFileSync(sessionLogPath, formatEntry(level, message));
  } catch {
    // Best-effort
  }
}

/** Get the path of the current session log file (null if not initialized). */
export function getSessionLogPath(): string | null {
  return sessionLogPath;
}

/** Get the directory where session logs are stored. */
export function getSessionLogDir(): string {
  return sessionPaths.log;
}
