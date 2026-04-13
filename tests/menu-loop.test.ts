import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Command } from "commander";

/**
 * Tests that interactive menu commands loop back to their menu after a
 * subcommand completes, instead of exiting (which would throw the user
 * back to the parent menu).
 *
 * Strategy: mock `select` to return an action on the first call, then
 * "back" on the second call. If the menu loops correctly, `select` is
 * called twice. If it doesn't loop, `select` is called only once.
 */

// ── Shared mocks (applied before each module reset) ────────────────────

function setupMocks(): void {
  vi.mock("@inquirer/prompts", () => ({
    select: vi.fn(),
    input: vi.fn(),
    confirm: vi.fn(),
    search: vi.fn(),
    checkbox: vi.fn(),
  }));

  vi.mock("../src/utils/interactive.js", () => ({
    isInteractive: () => true,
    isAutoConfirm: () => false,
    setAutoConfirm: vi.fn(),
    confirmAction: vi.fn().mockResolvedValue(true),
  }));

  vi.mock("../src/utils/spinner.js", () => ({
    createSilentSpinner: () => ({
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
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

  vi.mock("../src/utils/az.js", () => ({
    runAz: vi.fn().mockResolvedValue([]),
    ensureAz: vi.fn(),
  }));

  vi.mock("../src/commands/app/user-auth/require-azure.js", () => ({
    requireAzureBot: vi.fn().mockResolvedValue({
      appId: "test-app-id",
      botId: "test-bot-id",
      token: "test-token",
      azure: {
        subscription: "test-sub",
        resourceGroup: "test-rg",
      },
    }),
  }));

  vi.mock("../src/project/scaffold.js", () => ({
    listTemplates: vi.fn().mockReturnValue(["echo", "ai", "graph", "mcp", "mcpclient", "tab"]),
    listToolkits: vi.fn().mockReturnValue(["basic", "oauth", "embed"]),
    scaffoldProject: vi.fn().mockResolvedValue(undefined),
    addToolkitConfig: vi.fn().mockResolvedValue(undefined),
    removeToolkitConfig: vi.fn().mockResolvedValue(undefined),
    detectLanguage: vi.fn().mockReturnValue("typescript"),
  }));
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("user-auth menu loop", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("loops back to menu after selecting OAuth", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("oauth" as never)
      .mockResolvedValueOnce("back" as never);

    const { userAuthCommand } = await import(
      "../src/commands/app/user-auth/index.js"
    );

    const oauthParseSpy = vi.fn().mockResolvedValue(undefined);
    const oauthSub = userAuthCommand.commands.find(
      (c: Command) => c.name() === "oauth"
    );
    if (oauthSub) oauthSub.parseAsync = oauthParseSpy;

    await userAuthCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(oauthParseSpy).toHaveBeenCalledTimes(1);
  });

  it("loops back to menu after selecting SSO", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("sso" as never)
      .mockResolvedValueOnce("back" as never);

    const { userAuthCommand } = await import(
      "../src/commands/app/user-auth/index.js"
    );

    const ssoParseSpy = vi.fn().mockResolvedValue(undefined);
    const ssoSub = userAuthCommand.commands.find(
      (c: Command) => c.name() === "sso"
    );
    if (ssoSub) ssoSub.parseAsync = ssoParseSpy;

    await userAuthCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(ssoParseSpy).toHaveBeenCalledTimes(1);
  });

  it("exits immediately when Back is selected", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect.mockResolvedValueOnce("back" as never);

    const { userAuthCommand } = await import(
      "../src/commands/app/user-auth/index.js"
    );

    await userAuthCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });
});

describe("user-auth forwards appId", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("passes appId to oauth subcommand", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("oauth" as never)
      .mockResolvedValueOnce("back" as never);

    const { userAuthCommand } = await import(
      "../src/commands/app/user-auth/index.js"
    );

    const oauthParseSpy = vi.fn().mockResolvedValue(undefined);
    const oauthSub = userAuthCommand.commands.find(
      (c: Command) => c.name() === "oauth"
    );
    if (oauthSub) oauthSub.parseAsync = oauthParseSpy;

    await userAuthCommand.parseAsync(["my-app-id"], { from: "user" });

    expect(oauthParseSpy).toHaveBeenCalledWith(["my-app-id"], { from: "user" });
  });

  it("passes appId to sso subcommand", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("sso" as never)
      .mockResolvedValueOnce("back" as never);

    const { userAuthCommand } = await import(
      "../src/commands/app/user-auth/index.js"
    );

    const ssoParseSpy = vi.fn().mockResolvedValue(undefined);
    const ssoSub = userAuthCommand.commands.find(
      (c: Command) => c.name() === "sso"
    );
    if (ssoSub) ssoSub.parseAsync = ssoParseSpy;

    await userAuthCommand.parseAsync(["my-app-id"], { from: "user" });

    expect(ssoParseSpy).toHaveBeenCalledWith(["my-app-id"], { from: "user" });
  });
});

describe("oauth forwards appId", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("passes appId to add subcommand", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("add" as never)
      .mockResolvedValueOnce("back" as never);

    const { oauthCommand } = await import(
      "../src/commands/app/user-auth/oauth/index.js"
    );

    const addParseSpy = vi.fn().mockResolvedValue(undefined);
    const addSub = oauthCommand.commands.find(
      (c: Command) => c.name() === "add"
    );
    if (addSub) addSub.parseAsync = addParseSpy;

    await oauthCommand.parseAsync(["my-app-id"], { from: "user" });

    expect(addParseSpy).toHaveBeenCalledWith(["my-app-id"], { from: "user" });
  });
});

describe("sso forwards appId", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("passes appId to requireAzureBot", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect.mockResolvedValueOnce("back" as never);

    const { requireAzureBot } = await import(
      "../src/commands/app/user-auth/require-azure.js"
    );

    const { ssoCommand } = await import(
      "../src/commands/app/user-auth/sso/index.js"
    );

    await ssoCommand.parseAsync(["my-app-id"], { from: "user" });

    expect(requireAzureBot).toHaveBeenCalledWith("my-app-id");
  });
});

describe("oauth menu loop", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("loops back to menu after selecting Add", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("add" as never)
      .mockResolvedValueOnce("back" as never);

    const { oauthCommand } = await import(
      "../src/commands/app/user-auth/oauth/index.js"
    );

    const addParseSpy = vi.fn().mockResolvedValue(undefined);
    const addSub = oauthCommand.commands.find(
      (c: Command) => c.name() === "add"
    );
    if (addSub) addSub.parseAsync = addParseSpy;

    await oauthCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(addParseSpy).toHaveBeenCalledTimes(1);
  });

  it("loops back to menu after selecting List", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("list" as never)
      .mockResolvedValueOnce("back" as never);

    const { oauthCommand } = await import(
      "../src/commands/app/user-auth/oauth/index.js"
    );

    const listParseSpy = vi.fn().mockResolvedValue(undefined);
    const listSub = oauthCommand.commands.find(
      (c: Command) => c.name() === "list"
    );
    if (listSub) listSub.parseAsync = listParseSpy;

    await oauthCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(listParseSpy).toHaveBeenCalledTimes(1);
  });

  it("loops back to menu after selecting Remove", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("remove" as never)
      .mockResolvedValueOnce("back" as never);

    const { oauthCommand } = await import(
      "../src/commands/app/user-auth/oauth/index.js"
    );

    const removeParseSpy = vi.fn().mockResolvedValue(undefined);
    const removeSub = oauthCommand.commands.find(
      (c: Command) => c.name() === "remove"
    );
    if (removeSub) removeSub.parseAsync = removeParseSpy;

    await oauthCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(removeParseSpy).toHaveBeenCalledTimes(1);
  });

  it("exits immediately when Back is selected", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect.mockResolvedValueOnce("back" as never);

    const { oauthCommand } = await import(
      "../src/commands/app/user-auth/oauth/index.js"
    );

    await oauthCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });
});

describe("manifest menu loop", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();

    vi.mock("../src/utils/app-picker.js", () => ({
      pickApp: vi.fn().mockResolvedValue({
        app: { appId: "test-app-id", teamsAppId: "test-teams-app-id" },
        token: "test-token",
      }),
    }));

    vi.mock("../src/apps/index.js", () => ({
      fetchApp: vi.fn().mockResolvedValue({
        appId: "test-app-id",
        appName: "Test App",
      }),
    }));

    vi.mock("../src/commands/app/manifest/actions.js", () => ({
      downloadManifest: vi.fn().mockResolvedValue(undefined),
      uploadManifestFromFile: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it("loops back to menu after selecting Download", async () => {
    const { select, input } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    const mockedInput = vi.mocked(input);

    mockedSelect
      .mockResolvedValueOnce("download" as never)
      .mockResolvedValueOnce("back" as never);
    mockedInput.mockResolvedValueOnce("" as never);

    const { appManifestCommand } = await import(
      "../src/commands/app/manifest/index.js"
    );

    await appManifestCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
  });

  it("loops back to menu after selecting Upload", async () => {
    const { select, input } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    const mockedInput = vi.mocked(input);

    mockedSelect
      .mockResolvedValueOnce("upload" as never)
      .mockResolvedValueOnce("back" as never);
    mockedInput.mockResolvedValueOnce("./manifest.json" as never);

    const { appManifestCommand } = await import(
      "../src/commands/app/manifest/index.js"
    );

    await appManifestCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
  });

  it("exits immediately when Back is selected", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect.mockResolvedValueOnce("back" as never);

    const { appManifestCommand } = await import(
      "../src/commands/app/manifest/index.js"
    );

    await appManifestCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });
});

describe("project menu loop", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("loops back to menu after selecting New", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("new" as never)
      .mockResolvedValueOnce("back" as never);

    const { projectCommand } = await import(
      "../src/commands/project/index.js"
    );

    const newParseSpy = vi.fn().mockResolvedValue(undefined);
    const newSub = projectCommand.commands.find(
      (c: Command) => c.name() === "new"
    );
    if (newSub) newSub.parseAsync = newParseSpy;

    await projectCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(newParseSpy).toHaveBeenCalledTimes(1);
  });

  it("loops back to menu after selecting Config", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("config" as never)
      .mockResolvedValueOnce("back" as never);

    const { projectCommand } = await import(
      "../src/commands/project/index.js"
    );

    const configParseSpy = vi.fn().mockResolvedValue(undefined);
    const configSub = projectCommand.commands.find(
      (c: Command) => c.name() === "config"
    );
    if (configSub) configSub.parseAsync = configParseSpy;

    await projectCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(configParseSpy).toHaveBeenCalledTimes(1);
  });

  it("exits immediately when Back is selected", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect.mockResolvedValueOnce("back" as never);

    const { projectCommand } = await import(
      "../src/commands/project/index.js"
    );

    await projectCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });
});

describe("project new menu loop", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("loops back to menu after creating a project", async () => {
    const { select, input } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    const mockedInput = vi.mocked(input);

    mockedSelect
      .mockResolvedValueOnce("typescript" as never)
      .mockResolvedValueOnce("back" as never);
    mockedInput.mockResolvedValueOnce("test-app" as never);

    const { projectNewCommand } = await import(
      "../src/commands/project/new/index.js"
    );

    // Stub the TS subcommand to avoid actually scaffolding
    const tsSub = projectNewCommand.commands.find(
      (c: Command) => c.name() === "typescript"
    );
    if (tsSub) tsSub.parseAsync = vi.fn().mockResolvedValue(undefined);

    await projectNewCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
  });

  it("exits immediately when Back is selected", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect.mockResolvedValueOnce("back" as never);

    const { projectNewCommand } = await import(
      "../src/commands/project/new/index.js"
    );

    await projectNewCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });
});

describe("project config menu loop", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("loops back to menu after adding a toolkit", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("add" as never)
      .mockResolvedValueOnce("atk.basic" as never)
      .mockResolvedValueOnce("back" as never);

    const { projectConfigCommand } = await import(
      "../src/commands/project/config/index.js"
    );

    const addParseSpy = vi.fn().mockResolvedValue(undefined);
    const addSub = projectConfigCommand.commands.find(
      (c: Command) => c.name() === "add"
    );
    if (addSub) addSub.parseAsync = addParseSpy;

    await projectConfigCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(3);
    expect(addParseSpy).toHaveBeenCalledTimes(1);
  });

  it("exits immediately when Back is selected", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect.mockResolvedValueOnce("back" as never);

    const { projectConfigCommand } = await import(
      "../src/commands/project/config/index.js"
    );

    await projectConfigCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });
});

describe("config menu includes set-lang", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("loops back to menu after selecting set-lang", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("set-lang" as never)
      .mockResolvedValueOnce("back" as never);

    const { configCommand } = await import(
      "../src/commands/config/index.js"
    );

    const setLangSub = configCommand.commands.find(
      (c: Command) => c.name() === "set-lang"
    );
    if (setLangSub) setLangSub.parseAsync = vi.fn().mockResolvedValue(undefined);

    await configCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
  });
});

describe("sso menu loop", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("loops back to menu after selecting Setup", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect
      .mockResolvedValueOnce("setup" as never)
      .mockResolvedValueOnce("back" as never);

    const { ssoCommand } = await import(
      "../src/commands/app/user-auth/sso/index.js"
    );

    const setupParseSpy = vi.fn().mockResolvedValue(undefined);
    const setupSub = ssoCommand.commands.find(
      (c: Command) => c.name() === "setup"
    );
    if (setupSub) setupSub.parseAsync = setupParseSpy;

    await ssoCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(setupParseSpy).toHaveBeenCalledTimes(1);
  });

  it("loops back to menu after editing a connection", async () => {
    const { select } = await import("@inquirer/prompts");
    const { runAz } = await import("../src/utils/az.js");
    const mockedSelect = vi.mocked(select);

    vi.mocked(runAz).mockResolvedValue([
      {
        name: "bot/MyConnection",
        properties: {
          serviceProviderDisplayName: "Azure Active Directory v2",
          scopes: "User.Read",
        },
      },
    ]);

    mockedSelect
      .mockResolvedValueOnce("edit:MyConnection" as never)
      .mockResolvedValueOnce("back" as never);

    const { ssoCommand } = await import(
      "../src/commands/app/user-auth/sso/index.js"
    );

    const editParseSpy = vi.fn().mockResolvedValue(undefined);
    const editSub = ssoCommand.commands.find(
      (c: Command) => c.name() === "edit"
    );
    if (editSub) editSub.parseAsync = editParseSpy;

    await ssoCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(editParseSpy).toHaveBeenCalledTimes(1);
  });

  it("exits immediately when Back is selected", async () => {
    const { select } = await import("@inquirer/prompts");
    const mockedSelect = vi.mocked(select);
    mockedSelect.mockResolvedValueOnce("back" as never);

    const { ssoCommand } = await import(
      "../src/commands/app/user-auth/sso/index.js"
    );

    await ssoCommand.parseAsync([], { from: "user" });

    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });
});
