import AdmZip from "adm-zip";

export interface ManifestOptions {
  botId: string;
  botName: string;
  endpoint?: string;
  description?: { short: string; full?: string };
  scopes?: string[];
  developer?: {
    name: string;
    websiteUrl: string;
    privacyUrl: string;
    termsOfUseUrl: string;
  };
  colorIconBuffer?: Buffer;
  outlineIconBuffer?: Buffer;
}

export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

export interface Manifest {
  id: string;
  name: { short: string; full?: string };
  bots?: Array<{ botId: string; scopes: string[] }>;
  [key: string]: unknown;
}

export function createManifest(options: ManifestOptions): object {
  const {
    botId,
    botName,
    endpoint,
    description,
    scopes = ["personal", "team", "groupchat"],
    developer,
  } = options;

  const validDomains: string[] = ["*.botframework.com"];
  if (endpoint) {
    const domain = extractDomain(endpoint);
    if (domain) validDomains.push(domain);
  }

  return {
    $schema:
      "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
    manifestVersion: "1.16",
    version: "1.0.0",
    id: botId,
    packageName: `com.teams.${botId}`,
    developer: developer ?? {
      name: "Developer",
      websiteUrl: "https://www.example.com",
      privacyUrl: "https://www.example.com/privacy",
      termsOfUseUrl: "https://www.example.com/terms",
    },
    icons: {
      color: "color.png",
      outline: "outline.png",
    },
    name: {
      short: botName,
      full: botName,
    },
    description: {
      short: description?.short ?? botName,
      full: description?.full ?? description?.short ?? botName,
    },
    accentColor: "#FFFFFF",
    bots: [
      {
        botId: botId,
        scopes,
        supportsFiles: false,
        isNotificationOnly: false,
      },
    ],
    permissions: [],
    validDomains,
  };
}

function createPlaceholderPng(): Buffer {
  // Minimal valid PNG (1x1 transparent pixel)
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

export function createManifestZip(options: ManifestOptions): Buffer {
  const manifest = createManifest(options);
  const zip = new AdmZip();

  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addFile("color.png", options.colorIconBuffer ?? createPlaceholderPng());
  zip.addFile("outline.png", options.outlineIconBuffer ?? createPlaceholderPng());

  return zip.toBuffer();
}

