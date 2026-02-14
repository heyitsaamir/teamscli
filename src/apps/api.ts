import type { AppSummary } from "./types.js";

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
