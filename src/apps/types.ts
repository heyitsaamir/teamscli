export interface AppBot {
  botId: string;
  scopes?: string[];
}

export interface AppSummary {
  appId: string;
  appName: string | null;
  version: string | null;
  updatedAt: string | null;
  teamsAppId: string;
  bots?: AppBot[];
}
