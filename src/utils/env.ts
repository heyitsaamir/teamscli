import * as fs from "node:fs";
import * as path from "node:path";

export interface EnvValues {
  BOT_ID: string;
  BOT_PASSWORD: string;
  TEAMS_APP_ID: string;
  BOT_ENDPOINT?: string;
}

export function writeEnvFile(filePath: string, values: EnvValues): void {
  const resolvedPath = path.resolve(filePath);

  let content = "";
  if (fs.existsSync(resolvedPath)) {
    content = fs.readFileSync(resolvedPath, "utf-8");
  }

  const lines = content.split("\n");
  const existing = new Map<string, number>();

  lines.forEach((line, i) => {
    const match = line.match(/^([A-Z_]+)=/);
    if (match) {
      existing.set(match[1], i);
    }
  });

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const line = `${key}=${value}`;
    if (existing.has(key)) {
      lines[existing.get(key)!] = line;
    } else {
      lines.push(line);
    }
  }

  fs.writeFileSync(resolvedPath, lines.join("\n").trim() + "\n");
}
