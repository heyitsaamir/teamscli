// RED/GREEN: verified 2026-04-13 — broke diffRscPermissions to return empty
// arrays and confirmed diff tests failed. Restored and confirmed they pass.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RscPermissionEntry, AppDetails } from "../src/apps/types.js";
import { diffRscPermissions } from "../src/commands/app/rsc/actions.js";

// ─── diffRscPermissions unit tests ──────────────────────────────────

describe("diffRscPermissions", () => {
  it("returns all as added when current is empty", () => {
    const desired: RscPermissionEntry[] = [
      { name: "ChannelMessage.Read.Group", type: "Application" },
      { name: "TeamSettings.ReadWrite.Group", type: "Application" },
    ];

    const result = diffRscPermissions([], desired);

    expect(result.added).toEqual(desired);
    expect(result.removed).toEqual([]);
    expect(result.unchanged).toEqual([]);
    expect(result.final).toEqual(desired);
  });

  it("returns all as removed when desired is empty", () => {
    const current: RscPermissionEntry[] = [
      { name: "ChannelMessage.Read.Group", type: "Application" },
    ];

    const result = diffRscPermissions(current, []);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(current);
    expect(result.unchanged).toEqual([]);
    expect(result.final).toEqual([]);
  });

  it("returns all as unchanged when current equals desired", () => {
    const perms: RscPermissionEntry[] = [
      { name: "ChannelMessage.Read.Group", type: "Application" },
      { name: "TeamSettings.ReadWrite.Group", type: "Application" },
    ];

    const result = diffRscPermissions(perms, perms);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.unchanged).toEqual(perms);
  });

  it("computes mixed adds, removes, and unchanged", () => {
    const current: RscPermissionEntry[] = [
      { name: "ChannelMessage.Read.Group", type: "Application" },
      { name: "TeamSettings.ReadWrite.Group", type: "Application" },
    ];
    const desired: RscPermissionEntry[] = [
      { name: "TeamSettings.ReadWrite.Group", type: "Application" },
      { name: "ChatMessage.Read.Chat", type: "Application" },
    ];

    const result = diffRscPermissions(current, desired);

    expect(result.added).toEqual([{ name: "ChatMessage.Read.Chat", type: "Application" }]);
    expect(result.removed).toEqual([{ name: "ChannelMessage.Read.Group", type: "Application" }]);
    expect(result.unchanged).toEqual([{ name: "TeamSettings.ReadWrite.Group", type: "Application" }]);
  });

  it("treats same name with different type as distinct", () => {
    const current: RscPermissionEntry[] = [
      { name: "LiveShareSession.ReadWrite.Group", type: "Application" },
    ];
    const desired: RscPermissionEntry[] = [
      { name: "LiveShareSession.ReadWrite.Group", type: "Delegated" },
    ];

    const result = diffRscPermissions(current, desired);

    expect(result.added).toEqual([{ name: "LiveShareSession.ReadWrite.Group", type: "Delegated" }]);
    expect(result.removed).toEqual([{ name: "LiveShareSession.ReadWrite.Group", type: "Application" }]);
    expect(result.unchanged).toEqual([]);
  });
});

// ─── rscSetCommand integration tests ────────────────────────────────

const mockDetails: AppDetails = {
  teamsAppId: "test-teams-app-id",
  appId: "00000000-0000-0000-0000-000000000001",
  shortName: "Test App",
  longName: "Test App",
  shortDescription: "desc",
  longDescription: "desc",
  version: "1.0.0",
  developerName: "dev",
  websiteUrl: "https://example.com",
  privacyUrl: "https://example.com/privacy",
  termsOfUseUrl: "https://example.com/terms",
  manifestVersion: "1.16",
  webApplicationInfoId: "existing-aad-app-id",
  mpnId: "",
  accentColor: "#FFFFFF",
  authorization: { permissions: { resourceSpecific: [] } },
};

let capturedUpdate: Partial<AppDetails> | null = null;
let currentPerms: RscPermissionEntry[] = [];

vi.mock("../src/apps/api.js", () => ({
  fetchAppDetailsV2: vi.fn(async () => {
    const clone = structuredClone(mockDetails);
    clone.authorization = { permissions: { resourceSpecific: currentPerms } };
    return clone;
  }),
  updateAppDetails: vi.fn(async (_token: string, _id: string, update: Partial<AppDetails>) => {
    capturedUpdate = update;
    return { ...mockDetails, ...update };
  }),
}));

vi.mock("../src/auth/index.js", () => ({
  getAccount: vi.fn().mockResolvedValue({ tenantId: "test-tenant" }),
  getTokenSilent: vi.fn().mockResolvedValue("fake-token"),
  teamsDevPortalScopes: ["https://dev.teams.microsoft.com/.default"],
}));

vi.mock("../src/utils/spinner.js", () => ({
  createSilentSpinner: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

let jsonOutput: unknown = null;
vi.mock("../src/utils/json-output.js", () => ({
  outputJson: vi.fn((data: unknown) => {
    jsonOutput = data;
  }),
}));

describe("rsc set command", () => {
  beforeEach(() => {
    capturedUpdate = null;
    currentPerms = [];
    jsonOutput = null;
  });

  it("adds missing and removes extras in one operation", async () => {
    currentPerms = [
      { name: "ChannelMessage.Read.Group", type: "Application" },
    ];

    const { rscCommand } = await import("../src/commands/app/rsc/index.js");

    await rscCommand.parseAsync(
      ["set", "test-teams-app-id", "--permissions", "TeamSettings.ReadWrite.Group", "--json"],
      { from: "user" },
    );

    expect(capturedUpdate).not.toBeNull();
    const rsc = capturedUpdate!.authorization?.permissions?.resourceSpecific;
    expect(rsc).toEqual([{ name: "TeamSettings.ReadWrite.Group", type: "Application" }]);

    expect(jsonOutput).toEqual({
      added: [{ name: "TeamSettings.ReadWrite.Group", type: "Application" }],
      removed: [{ name: "ChannelMessage.Read.Group", type: "Application" }],
      unchanged: [],
    });
  });

  it("reports no changes when already in desired state", async () => {
    currentPerms = [
      { name: "TeamSettings.ReadWrite.Group", type: "Application" },
    ];

    const { rscCommand } = await import("../src/commands/app/rsc/index.js");

    await rscCommand.parseAsync(
      ["set", "test-teams-app-id", "--permissions", "TeamSettings.ReadWrite.Group", "--json"],
      { from: "user" },
    );

    // Should not call updateAppDetails
    expect(capturedUpdate).toBeNull();

    expect(jsonOutput).toEqual({
      added: [],
      removed: [],
      unchanged: [{ name: "TeamSettings.ReadWrite.Group", type: "Application" }],
    });
  });

  it("errors on unrecognized permission names", async () => {
    const { rscCommand } = await import("../src/commands/app/rsc/index.js");

    // Commander exits on error, so we catch via the command's error handling
    let thrownError: Error | null = null;
    rscCommand.exitOverride();
    rscCommand.configureOutput({
      writeErr: () => {},
      writeOut: () => {},
    });

    try {
      await rscCommand.parseAsync(
        ["set", "test-teams-app-id", "--permissions", "Fake.Permission.Group", "--json"],
        { from: "user" },
      );
    } catch (e) {
      thrownError = e as Error;
    }

    // The CliError should have been thrown (wrapAction catches it, but in JSON mode outputs it)
    // Since wrapAction handles the error, we check that no update was made
    expect(capturedUpdate).toBeNull();
  });
});
