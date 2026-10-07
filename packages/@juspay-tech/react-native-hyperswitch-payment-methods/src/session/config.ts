import type {
  CommonEndpoint,
  HyperswitchEnvironment,
  OverrideEndpoints,
} from './fetchVaultDetails';

export interface HyperswitchConfiguration {
  publishableKey: string;
  platformPublishableKey?: string;
  profileId?: string;
  environment?: HyperswitchEnvironment;
  customEndpoints?: CommonEndpoint | OverrideEndpoints;
}

export function environmentOf(environment: unknown): HyperswitchEnvironment {
  return environment === 'PROD_EU' ||
    environment === 'SANDBOX' ||
    environment === 'INTEG'
    ? environment
    : 'PROD';
}
