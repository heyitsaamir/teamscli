import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { outputJson } from "../utils/json-output.js";
import { logger } from "../utils/logger.js";
import { getSessionLogDir, getSessionLogPath } from "../utils/session-log.js";
import { wrapAction } from "../utils/errors.js";
import { formatDate } from "../utils/date.js";

interface SessionEntry {
  file: string;
  path: string;
  timestamp: string;
  current: boolean;
}

interface LogsOutput {
  logDir: string;
  currentSession: string | null;
  recentSessions: SessionEntry[];
}

interface LogsOptions {
  json?: boolean;
}

function listRecentSessions(logDir: string, limit = 10): SessionEntry[] {
  try {
    const currentPath = getSessionLogPath();
    return readdirSync(logDir)
      .filter((f) => f.startsWith("teams-cli-") && f.endsWith(".log"))
      .map((f) => {
        const fullPath = join(logDir, f);
        const mtime = statSync(fullPath).mtime;
        return {
          file: f,
          path: fullPath,
          timestamp: mtime.toISOString(),
          current: fullPath === currentPath,
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export const logsCommand = new Command("logs")
  .description("Show session log location and recent sessions")
  .option("--json", "[OPTIONAL] Output as JSON")
  .action(
    wrapAction(async (options: LogsOptions) => {
      const logDir = getSessionLogDir();
      const currentSession = getSessionLogPath();
      const recentSessions = listRecentSessions(logDir);

      if (options.json) {
        const result: LogsOutput = {
          logDir,
          currentSession,
          recentSessions,
        };
        outputJson(result);
        return;
      }

      logger.info(`${pc.dim("Session logs directory:")} ${logDir}\n`);

      if (recentSessions.length === 0) {
        logger.info(pc.dim("No session logs found."));
      } else {
        logger.info(pc.dim("Recent sessions (newest first):"));
        for (const s of recentSessions) {
          const date = formatDate(s.timestamp);
          const tag = s.current ? pc.green(" (current)") : "";
          logger.info(`  ${pc.dim(date)}  ${s.file}${tag}`);
        }
      }

      if (currentSession) {
        logger.info(
          `\n${pc.dim("To get support, share your current session log:")}\n  ${pc.cyan(currentSession)}`
        );
      }
    })
  );
