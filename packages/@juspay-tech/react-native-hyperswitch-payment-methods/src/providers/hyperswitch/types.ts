import type { HyperswitchEnvironment } from '../../session/fetchVaultDetails';

export interface HyperswitchVaultData {
  sdkAuthorization: string;
  environment?: HyperswitchEnvironment;
}
