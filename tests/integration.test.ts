import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = "node dist/index.js";

// Increase timeout for API calls
const TEST_TIMEOUT = 30000;

function loadTestEnv(): { TEST_APP_ID: string } {
  const envPath = resolve(__dirname, "../.testenv");
  if (!existsSync(envPath)) {
    throw new Error(
      "Missing .testenv file. Copy .testenv.example to .testenv and set TEST_APP_ID"
    );
  }

  const content = readFileSync(envPath, "utf-8");
  const match = content.match(/^TEST_APP_ID=(.+)$/m);
  if (!match || !match[1] || match[1] === "your-app-id-here") {
    throw new Error("TEST_APP_ID not set in .testenv");
  }

  return { TEST_APP_ID: match[1].trim() };
}

function run(command: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(command, { encoding: "utf-8", stdio: "pipe" });
    return { stdout, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; status?: number };
    return {
      stdout: execError.stdout ?? "",
      exitCode: execError.status ?? 1,
    };
  }
}

function getManifest(appId: string): Record<string, unknown> {
  const { stdout } = run(`${CLI} app --id "${appId}" manifest download`);
  // Find the JSON object in the output (starts with { and ends with })
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in output: ${stdout}`);
  }
  return JSON.parse(jsonMatch[0]);
}

function getManifestField(appId: string, path: string): string {
  const manifest = getManifest(appId);
  const parts = path.split(".");
  let value: unknown = manifest;
  for (const part of parts) {
    value = (value as Record<string, unknown>)[part];
  }
  return String(value ?? "");
}

describe("CLI Validation Tests", () => {
  // Validation happens after app fetch, so we need a real app ID
  let appId: string;

  beforeAll(() => {
    const env = loadTestEnv();
    appId = env.TEST_APP_ID;
  });

  it("rejects short name over 30 characters", () => {
    const longName = "x".repeat(31);
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-name "${longName}"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/30 characters or less/);
  });

  it("rejects long name over 100 characters", () => {
    const longName = "x".repeat(101);
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-long-name "${longName}"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/100 characters or less/);
  });

  it("rejects short description over 80 characters", () => {
    const longDesc = "x".repeat(81);
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-short-description "${longDesc}"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/80 characters or less/);
  });

  it("rejects long description over 4000 characters", () => {
    const longDesc = "x".repeat(4001);
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-long-description "${longDesc}"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/4000 characters or less/);
  });

  it("rejects website URL without https", () => {
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-website "http://example.com"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/https:\/\//);
  });

  it("rejects website URL with only https://", () => {
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-website "https://"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/include a domain/);
  });

  it("rejects privacy URL without https", () => {
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-privacy-url "http://example.com"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/https:\/\//);
  });

  it("rejects privacy URL with only https://", () => {
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-privacy-url "https://"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/include a domain/);
  });

  it("rejects terms URL without https", () => {
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-terms-url "http://example.com"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/https:\/\//);
  });

  it("rejects terms URL with only https://", () => {
    const { stdout, exitCode } = run(
      `${CLI} app --id "${appId}" --set-terms-url "https://"`
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/include a domain/);
  });
});

describe("Integration Tests (requires auth + .testenv)", () => {
  let appId: string;
  const originals: Record<string, string> = {};

  beforeAll(() => {
    const env = loadTestEnv();
    appId = env.TEST_APP_ID;

    // Store original values for restoration
    const manifest = getManifest(appId);
    const name = manifest.name as Record<string, string>;
    const developer = manifest.developer as Record<string, string>;
    const description = manifest.description as Record<string, string>;

    originals["name.short"] = name.short;
    originals["name.full"] = name.full;
    originals["version"] = manifest.version as string;
    originals["developer.name"] = developer.name;
    originals["developer.websiteUrl"] = developer.websiteUrl;
    originals["developer.privacyUrl"] = developer.privacyUrl;
    originals["developer.termsOfUseUrl"] = developer.termsOfUseUrl;
    originals["description.short"] = description.short;
    originals["description.full"] = description.full;
  });

  afterAll(
    () => {
      // Restore all original values in a single CLI call (2 API calls total)
      if (!appId) return;

      run(
        `${CLI} app --id "${appId}" ` +
          `--set-name "${originals["name.short"]}" ` +
          `--set-long-name "${originals["name.full"]}" ` +
          `--set-version "${originals["version"]}" ` +
          `--set-developer "${originals["developer.name"]}" ` +
          `--set-website "${originals["developer.websiteUrl"]}" ` +
          `--set-privacy-url "${originals["developer.privacyUrl"]}" ` +
          `--set-terms-url "${originals["developer.termsOfUseUrl"]}" ` +
          `--set-short-description "${originals["description.short"]}" ` +
          `--set-long-description "${originals["description.full"]}"`
      );
    },
    TEST_TIMEOUT
  );

  it("updates short name and verifies", () => {
    const testValue = `Test${Date.now()}`.slice(0, 30);
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-name "${testValue}"`
    );
    expect(exitCode).toBe(0);

    const actual = getManifestField(appId, "name.short");
    expect(actual).toBe(testValue);
  });

  it("updates long name and verifies", () => {
    const testValue = "Test Long Name " + Date.now();
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-long-name "${testValue}"`
    );
    expect(exitCode).toBe(0);

    const actual = getManifestField(appId, "name.full");
    expect(actual).toBe(testValue);
  });

  it("updates version and verifies", () => {
    const testValue = "9.8.7";
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-version "${testValue}"`
    );
    expect(exitCode).toBe(0);

    const actual = getManifestField(appId, "version");
    expect(actual).toBe(testValue);
  });

  it("updates developer name and verifies", () => {
    const testValue = "Test Developer " + Date.now();
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-developer "${testValue}"`
    );
    expect(exitCode).toBe(0);

    const actual = getManifestField(appId, "developer.name");
    expect(actual).toBe(testValue);
  });

  it("updates website URL and verifies", () => {
    const testValue = `https://test-${Date.now()}.example.com`;
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-website "${testValue}"`
    );
    expect(exitCode).toBe(0);

    const actual = getManifestField(appId, "developer.websiteUrl");
    expect(actual).toBe(testValue);
  });

  it("updates privacy URL and verifies", () => {
    const testValue = `https://test-${Date.now()}.example.com/privacy`;
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-privacy-url "${testValue}"`
    );
    expect(exitCode).toBe(0);

    const actual = getManifestField(appId, "developer.privacyUrl");
    expect(actual).toBe(testValue);
  });

  it("updates terms URL and verifies", () => {
    const testValue = `https://test-${Date.now()}.example.com/terms`;
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-terms-url "${testValue}"`
    );
    expect(exitCode).toBe(0);

    const actual = getManifestField(appId, "developer.termsOfUseUrl");
    expect(actual).toBe(testValue);
  });

  it("updates short description and verifies", () => {
    const testValue = "Test short description " + Date.now();
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-short-description "${testValue}"`
    );
    expect(exitCode).toBe(0);

    const actual = getManifestField(appId, "description.short");
    expect(actual).toBe(testValue);
  });

  it(
    "updates long description and verifies",
    () => {
      const testValue = "Test long description with more details " + Date.now();
      const { exitCode } = run(
        `${CLI} app --id "${appId}" --set-long-description "${testValue}"`
      );
      expect(exitCode).toBe(0);

      const actual = getManifestField(appId, "description.full");
      expect(actual).toBe(testValue);
    },
    TEST_TIMEOUT
  );

  it("updates multiple fields at once and verifies all", () => {
    const testName = `Multi${Date.now()}`.slice(0, 30);
    const testVersion = "1.2.3";
    const { exitCode } = run(
      `${CLI} app --id "${appId}" --set-name "${testName}" --set-version "${testVersion}"`
    );
    expect(exitCode).toBe(0);

    const actualName = getManifestField(appId, "name.short");
    const actualVersion = getManifestField(appId, "version");
    expect(actualName).toBe(testName);
    expect(actualVersion).toBe(testVersion);
  });
});
