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

/**
 * Full app details from the v2 API endpoint.
 * Contains all editable fields plus additional properties that must be preserved.
 */
export interface AppDetails {
  teamsAppId: string;
  appId: string;

  // Editable basic info fields
  shortName: string;
  longName: string;
  shortDescription: string;
  longDescription: string;
  version: string;
  developerName: string;
  websiteUrl: string;
  privacyUrl: string;
  termsOfUseUrl: string;

  // Additional fields that must be preserved
  manifestVersion: string;
  webApplicationInfoId: string;
  mpnId: string;
  accentColor: string;
  colorIcon?: string;
  outlineIcon?: string;
  bots?: AppBot[];

  // Allow pass-through of unknown fields from the API
  [key: string]: unknown;
}

/**
 * OAuth configuration for custom identity providers.
 */
export interface OAuthConfigurationCustom {
  oAuthConfigId: string;
  description: string;
  identityProvider: "Custom";
  applicableToApps: "SpecificApp" | "AnyApp";
  m365AppId?: string;
  targetAudience: "HomeTenant" | "AnyTenant";
  tenantId?: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  targetUrlsShouldStartWith: string[];
  authorizationEndpoint: string;
  tokenExchangeEndpoint: string;
  tokenRefreshEndpoint?: string;
  isPKCEEnabled?: boolean;
  tokenExchangeMethodType?: "BasicAuthorizationHeader" | "PostRequestBody";
  useSingleSignOn?: boolean;
  createdDateTime?: string;
  resourceIdentifierUri?: string;
}

/**
 * OAuth configuration for Microsoft Entra identity provider.
 */
export interface OAuthConfigurationEntra {
  oAuthConfigId: string;
  description: string;
  identityProvider: "MicrosoftEntra";
  applicableToApps: "SpecificApp" | "AnyApp";
  m365AppId?: string;
  targetAudience: "HomeTenant" | "AnyTenant";
  tenantId?: string;
  clientId: string;
  scopes: string[];
  targetUrlsShouldStartWith: string[];
  createdDateTime?: string;
  resourceIdentifierUri?: string;
}

export type OAuthConfiguration = OAuthConfigurationCustom | OAuthConfigurationEntra;

/**
 * Response from creating an OAuth configuration.
 */
export interface OAuthConfigurationCreateResponse {
  configurationRegistrationId: {
    oAuthConfigId: string;
  };
  resourceIdentifierUri: string;
}
