import type { AppSummary, AppDetails } from "./types.js";

const TDP_BASE_URL = "https://dev.teams.microsoft.com/api";

export async function fetchApps(token: string): Promise<AppSummary[]> {
  const response = await fetch(`${TDP_BASE_URL}/appdefinitions/my?pageNumber=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch apps: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchApp(token: string, id: string): Promise<AppSummary> {
  const response = await fetch(`${TDP_BASE_URL}/appdefinitions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch app: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function downloadAppPackage(token: string, appId: string): Promise<Buffer> {
  const response = await fetch(`${TDP_BASE_URL}/appdefinitions/${appId}/manifest`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download app package: ${response.status} ${response.statusText}`);
  }

  // Response is a JSON-encoded base64 string (with quotes)
  const base64String = await response.json();
  return Buffer.from(base64String, "base64");
}

/**
 * Fetch full app details using the v2 API endpoint.
 * Returns all editable fields plus internal properties that must be preserved on update.
 */
export async function fetchAppDetailsV2(token: string, teamsAppId: string): Promise<AppDetails> {
  const response = await fetch(`${TDP_BASE_URL}/appdefinitions/v2/${teamsAppId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch app details: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update app details using the read-modify-write pattern.
 * Fetches current full object, merges updates, and POSTs the full object back.
 */
export async function updateAppDetails(
  token: string,
  teamsAppId: string,
  updates: Partial<AppDetails>
): Promise<AppDetails> {
  // 1. Fetch current full object
  const currentDetails = await fetchAppDetailsV2(token, teamsAppId);

  // 2. Merge updates into it
  const updatedDetails = { ...currentDetails, ...updates };

  // 3. POST full object back
  const response = await fetch(`${TDP_BASE_URL}/appdefinitions/v2/${teamsAppId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedDetails),
  });

  if (!response.ok) {
    throw new Error(`Failed to update app details: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
