import { fetchAppDetailsV2, updateAppDetails } from "../../../apps/api.js";
import type { RscPermissionEntry, AppAuthorization } from "../../../apps/types.js";

/**
 * Read current RSC permissions from the app.
 */
export async function listRscPermissions(
  token: string,
  teamsAppId: string,
): Promise<RscPermissionEntry[]> {
  const details = await fetchAppDetailsV2(token, teamsAppId);
  return details.authorization?.permissions?.resourceSpecific ?? [];
}

/**
 * Build an authorization update that preserves sibling fields (e.g. orgWide)
 * while only replacing resourceSpecific.
 */
async function buildAuthorizationUpdate(
  token: string,
  teamsAppId: string,
  newResourceSpecific: RscPermissionEntry[],
): Promise<{ authorization: AppAuthorization }> {
  const details = await fetchAppDetailsV2(token, teamsAppId);
  const currentAuth = details.authorization ?? {};
  const currentPerms = currentAuth.permissions ?? {};
  return {
    authorization: {
      ...currentAuth,
      permissions: {
        ...currentPerms,
        resourceSpecific: newResourceSpecific,
      },
    },
  };
}

/**
 * Add RSC permissions to the app (merges with existing, skips duplicates).
 * Returns the list of permissions that were actually added (excludes already-existing ones).
 */
export async function addRscPermissions(
  token: string,
  teamsAppId: string,
  permissions: RscPermissionEntry[],
): Promise<{ added: RscPermissionEntry[]; skipped: RscPermissionEntry[] }> {
  const current = await listRscPermissions(token, teamsAppId);
  const existingNames = new Set(current.map((p) => p.name));

  const added: RscPermissionEntry[] = [];
  const skipped: RscPermissionEntry[] = [];

  for (const perm of permissions) {
    if (existingNames.has(perm.name)) {
      skipped.push(perm);
    } else {
      added.push(perm);
    }
  }

  if (added.length > 0) {
    const merged = [...current, ...added];
    const update = await buildAuthorizationUpdate(token, teamsAppId, merged);
    await updateAppDetails(token, teamsAppId, update);
  }

  return { added, skipped };
}

/**
 * Remove RSC permissions from the app by name.
 * Returns the list of permissions that were actually removed.
 */
export async function removeRscPermissions(
  token: string,
  teamsAppId: string,
  permissionNames: string[],
): Promise<{ removed: string[]; notFound: string[] }> {
  const current = await listRscPermissions(token, teamsAppId);
  const currentNames = new Set(current.map((p) => p.name));

  const removed: string[] = [];
  const notFound: string[] = [];

  for (const name of permissionNames) {
    if (currentNames.has(name)) {
      removed.push(name);
    } else {
      notFound.push(name);
    }
  }

  if (removed.length > 0) {
    const removedSet = new Set(removed);
    const filtered = current.filter((p) => !removedSet.has(p.name));
    const update = await buildAuthorizationUpdate(token, teamsAppId, filtered);
    await updateAppDetails(token, teamsAppId, update);
  }

  return { removed, notFound };
}
