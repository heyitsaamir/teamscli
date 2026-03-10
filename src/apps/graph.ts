import type { AadApp } from "./tdp.js";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export interface ClientSecret {
  secretText: string;
  displayName: string;
  endDateTime: string;
}

export async function getAadAppByClientId(
  token: string,
  clientId: string,
): Promise<AadApp> {
  const response = await fetch(
    `${GRAPH_BASE_URL}/applications?$filter=appId eq '${clientId}'`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to look up AAD app: ${response.status} ${error}`);
  }

  const data = (await response.json()) as { value: AadApp[] };
  if (data.value.length === 0) {
    throw new Error(`No AAD app found with clientId ${clientId}`);
  }

  return data.value[0];
}

export async function createClientSecret(
  token: string,
  appRegistrationId: string
): Promise<ClientSecret> {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 2);

  const response = await fetch(
    `${GRAPH_BASE_URL}/applications/${appRegistrationId}/addPassword`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        passwordCredential: {
          displayName: "default",
          endDateTime: expiryDate.toISOString(),
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create client secret: ${response.status} ${error}`);
  }

  return response.json();
}
