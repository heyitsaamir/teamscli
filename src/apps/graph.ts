const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export interface AadApp {
  id: string;
  appId: string;
  displayName: string;
}

export interface ClientSecret {
  secretText: string;
  displayName: string;
  endDateTime: string;
}

export async function createAadApp(token: string, displayName: string): Promise<AadApp> {
  const response = await fetch(`${GRAPH_BASE_URL}/applications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      displayName,
      signInAudience: "AzureADMultipleOrgs",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create AAD app: ${response.status} ${error}`);
  }

  return response.json();
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
