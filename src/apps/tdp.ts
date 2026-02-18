const TDP_BASE_URL = "https://dev.teams.microsoft.com/api";

export interface ImportedApp {
  teamsAppId: string;
}

export interface BotRegistration {
  botId: string;
  name: string;
}

export async function importAppPackage(
  token: string,
  zipBuffer: Buffer
): Promise<ImportedApp> {
  const response = await fetch(`${TDP_BASE_URL}/appdefinitions/v2/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
    },
    body: new Uint8Array(zipBuffer),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to import app package: ${response.status} ${error}`);
  }

  return response.json();
}

export async function registerBot(
  token: string,
  options: {
    botId: string;
    name: string;
    endpoint: string;
  }
): Promise<BotRegistration> {
  const response = await fetch(`${TDP_BASE_URL}/botframework`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      botId: options.botId,
      name: options.name,
      description: "",
      messagingEndpoint: options.endpoint,
      callingEndpoint: "",
      configuredChannels: ["msteams"],
      isSingleTenant: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to register bot: ${response.status} ${error}`);
  }

  return response.json();
}
