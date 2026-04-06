import { apiFetch } from "../utils/http.js";

const TDP_BASE_URL = "https://dev.teams.microsoft.com/api";

export type BotLocation = "bf" | "azure";

/**
 * Detect whether a bot lives in the Bot Framework tenant (created via TDP)
 * or in Azure (user's subscription).
 *
 * Uses TDP's /botframework endpoint: 200 = BF tenant, 404 = Azure.
 */
export async function getBotLocation(token: string, botId: string): Promise<BotLocation> {
  const response = await apiFetch(`${TDP_BASE_URL}/botframework/${botId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) return "bf";
  if (response.status === 404) return "azure";

  throw new Error(`Failed to check bot location: ${response.status} ${response.statusText}`);
}
