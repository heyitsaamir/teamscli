// RED/GREEN: verified 2026-04-10
// RED: removed "*.botframework.com" from manifest validDomains default — test failed
//      because createManifest() returned validDomains without the wildcard entry.
// GREEN: restored "*.botframework.com" — test passes.

import { describe, it, expect } from "vitest";
import { createManifest } from "../src/apps/manifest.js";

describe("manifest validDomains includes *.botframework.com", () => {
  it("includes *.botframework.com by default with no endpoint", () => {
    const manifest = createManifest({
      botId: "test-bot-id",
      botName: "Test Bot",
    }) as { validDomains: string[] };

    expect(manifest.validDomains).toContain("*.botframework.com");
  });

  it("includes *.botframework.com alongside endpoint domain", () => {
    const manifest = createManifest({
      botId: "test-bot-id",
      botName: "Test Bot",
      endpoint: "https://mybot.azurewebsites.net/api/messages",
    }) as { validDomains: string[] };

    expect(manifest.validDomains).toContain("*.botframework.com");
    expect(manifest.validDomains).toContain("mybot.azurewebsites.net");
  });
});
