import { PublicClientApplication, AccountInfo, DeviceCodeRequest } from "@azure/msal-node";
import { msalConfig, loginScopes } from "./config.js";
import { createCachePlugin } from "./cache.js";

let msalClient: PublicClientApplication | null = null;

export async function getMsalClient(): Promise<PublicClientApplication> {
  if (msalClient) {
    return msalClient;
  }

  const cachePlugin = await createCachePlugin();
  const config = {
    ...msalConfig,
    cache: {
      cachePlugin,
    },
  };

  msalClient = new PublicClientApplication(config);
  return msalClient;
}

export async function getAccount(): Promise<AccountInfo | null> {
  const client = await getMsalClient();
  const cache = client.getTokenCache();
  const accounts = await cache.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

export async function login(): Promise<AccountInfo> {
  const client = await getMsalClient();

  const deviceCodeRequest: DeviceCodeRequest = {
    scopes: loginScopes,
    deviceCodeCallback: (response) => {
      console.log(response.message);
    },
  };

  const result = await client.acquireTokenByDeviceCode(deviceCodeRequest);

  if (!result?.account) {
    throw new Error("Login failed: no account returned");
  }

  return result.account;
}

export async function logout(): Promise<void> {
  const client = await getMsalClient();
  const cache = client.getTokenCache();
  const accounts = await cache.getAllAccounts();

  for (const account of accounts) {
    await cache.removeAccount(account);
  }
}

export async function getTokenSilent(scopes: string[]): Promise<string | null> {
  const client = await getMsalClient();
  const account = await getAccount();

  if (!account) {
    return null;
  }

  try {
    const result = await client.acquireTokenSilent({
      scopes,
      account,
    });
    return result?.accessToken ?? null;
  } catch {
    return null;
  }
}
