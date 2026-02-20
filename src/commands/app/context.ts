/**
 * Shared context for app subcommands.
 * The parent app command populates this before subcommands run.
 */
export interface AppContext {
  appId?: string;
  token?: string;
}

export const appContext: AppContext = {};
