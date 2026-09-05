/* TypeScript file generated from VaultEndpoint.res by genType. */

/* eslint-disable */
/* tslint:disable */

export type vaultEndpointConfig = { readonly baseUrl: string };

export type overrideEndpointConfiguration = {
  readonly customBackendEndpoint?: string; 
  readonly customLoggingEndpoint?: string; 
  readonly customAssetEndpoint?: string; 
  readonly customSDKConfigEndpoint?: string; 
  readonly customAirborneEndpoint?: string
};

export type customEndpoints = { readonly commonEndpoint?: string; readonly overrideEndpoints?: overrideEndpointConfiguration };
