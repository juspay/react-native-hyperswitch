import type {
  DirectCardEligibility,
  DirectCardholderNameMode,
} from '../../core/types';

export interface HyperswitchVaultData {
  sdkAuthorization: string;
  environment?: 'PROD' | 'SANDBOX' | 'INTEG';
}

/**
 * Validated `DirectCardConfig` for the Hyperswitch provider. Nothing here
 * refers to a vault or a payment-method session: a direct form has neither.
 */
export interface HyperswitchDirectData {
  environment: 'PROD' | 'SANDBOX' | 'INTEG';
  /** Normalized: always an array, possibly empty. */
  enabledCardSchemes: string[];
  eligibility?: DirectCardEligibility;
  cardholderName?: DirectCardholderNameMode;
}
