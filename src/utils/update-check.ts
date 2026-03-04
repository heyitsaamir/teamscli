import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import pc from "picocolors";
import { paths } from "../auth/config.js";
import { isInteractive } from "./interactive.js";

const STATE_FILE = join(paths.cache, "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RELEASE_API = "https://api.github.com/repos/heyitsaamir/teamscli/releases/latest";

interface UpdateState {
  lastCheck: number;
  latestVersion?: string;
}

async function readState(): Promise<UpdateState | null> {
  try {
    const data = await readFile(STATE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeState(state: UpdateState): Promise<void> {
  try {
    await mkdir(paths.cache, { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state));
  } catch {
    // Best-effort
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { tag_name?: string };
    return data.tag_name?.replace(/^v/, "") ?? null;
  } catch {
    return null;
  }
}

/**
 * Check for updates once daily. Prints a hint if a newer version is available.
 * Non-blocking — silently skips on any failure.
 */
export async function checkForUpdates(): Promise<void> {
  if (!isInteractive()) return;

  try {
    const state = await readState();
    const now = Date.now();

    if (state && now - state.lastCheck < CHECK_INTERVAL_MS) {
      // Already checked recently — just show hint if we cached a newer version
      if (state.latestVersion) {
        showUpdateHint(state.latestVersion);
      }
      return;
    }

    const latestVersion = await fetchLatestVersion();
    const newState: UpdateState = { lastCheck: now };

    if (latestVersion && isNewer(latestVersion)) {
      newState.latestVersion = latestVersion;
      showUpdateHint(latestVersion);
    }

    await writeState(newState);
  } catch {
    // Never block the CLI
  }
}

function showUpdateHint(latestVersion: string): void {
  const require = createRequire(import.meta.url);
  const { version: currentVersion } = require("../../package.json");
  if (!isNewer(latestVersion, currentVersion)) return;

  console.log(
    pc.yellow(`\nUpdate available: ${pc.dim(currentVersion)} → ${pc.bold(latestVersion)}`) +
    `  Run ${pc.cyan("teams2 self-update")} to update.\n`
  );
}

function isNewer(latest: string, current?: string): boolean {
  if (!current) {
    const require = createRequire(import.meta.url);
    current = require("../../package.json").version;
  }

  const parse = (v: string) => v.split(".").map(Number);
  const l = parse(latest);
  const c = parse(current!);

  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lp = l[i] ?? 0;
    const cp = c[i] ?? 0;
    if (lp > cp) return true;
    if (lp < cp) return false;
  }
  return false;
}
