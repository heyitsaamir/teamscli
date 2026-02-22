import type {
  OAuthConfiguration,
  OAuthConfigurationCustom,
  OAuthConfigurationCreateResponse,
} from "./types.js";

const TDP_BASE_URL = "https://dev.teams.microsoft.com/api";

/**
 * Fetch all OAuth configurations, optionally filtered by identity provider.
 */
export async function fetchOAuthConfigurations(
  token: string,
  identityProvider?: "Custom" | "MicrosoftEntra"
): Promise<OAuthConfiguration[]> {
  const url = identityProvider
    ? `${TDP_BASE_URL}/v1.0/oauthConfigurations?identityProvider=${identityProvider}`
    : `${TDP_BASE_URL}/v1.0/oauthConfigurations`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OAuth configurations: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single OAuth configuration by ID.
 */
export async function fetchOAuthConfiguration(
  token: string,
  configId: string
): Promise<OAuthConfiguration> {
  const response = await fetch(`${TDP_BASE_URL}/v1.0/oauthConfigurations/${configId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OAuth configuration: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new OAuth configuration.
 * Returns the created config ID, then fetches the full config.
 */
export async function createOAuthConfiguration(
  token: string,
  config: Omit<OAuthConfigurationCustom, "oAuthConfigId" | "createdDateTime" | "resourceIdentifierUri">
): Promise<OAuthConfiguration> {
  const response = await fetch(`${TDP_BASE_URL}/v1.0/oauthConfigurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create OAuth configuration: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const createResponse: OAuthConfigurationCreateResponse = await response.json();
  const configId = createResponse.configurationRegistrationId.oAuthConfigId;

  // Fetch the full config using the returned ID
  return fetchOAuthConfiguration(token, configId);
}

/**
 * Update an existing OAuth configuration.
 */
export async function updateOAuthConfiguration(
  token: string,
  configId: string,
  updates: Partial<OAuthConfigurationCustom>
): Promise<OAuthConfiguration> {
  const response = await fetch(`${TDP_BASE_URL}/v1.0/oauthConfigurations/${configId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update OAuth configuration: ${response.status} ${response.statusText}\n${errorText}`);
  }

  // Fetch the full updated config
  return fetchOAuthConfiguration(token, configId);
}

/**
 * Delete an OAuth configuration.
 */
export async function deleteOAuthConfiguration(
  token: string,
  configId: string
): Promise<void> {
  const response = await fetch(`${TDP_BASE_URL}/v1.0/oauthConfigurations/${configId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete OAuth configuration: ${response.status} ${response.statusText}`);
  }
}
