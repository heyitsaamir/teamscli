import {
  PersistenceCreator,
  PersistenceCachePlugin,
  IPersistenceConfiguration,
} from "@azure/msal-node-extensions";
import { paths } from "./config.js";
import * as fs from "node:fs";
import * as path from "node:path";

const CACHE_FILE = "msal-cache.json";

export async function createCachePlugin(): Promise<PersistenceCachePlugin> {
  // Ensure config directory exists
  if (!fs.existsSync(paths.config)) {
    fs.mkdirSync(paths.config, { recursive: true });
  }

  const cachePath = path.join(paths.config, CACHE_FILE);

  const persistenceConfig: IPersistenceConfiguration = {
    cachePath,
    dataProtectionScope: "CurrentUser",
    serviceName: "teams-cli",
    accountName: "msal-cache",
    usePlaintextFileOnLinux: false,
  };

  const persistence = await PersistenceCreator.createPersistence(persistenceConfig);

  return new PersistenceCachePlugin(persistence);
}
