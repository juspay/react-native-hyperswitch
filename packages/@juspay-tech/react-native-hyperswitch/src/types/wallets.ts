/**
 * Wallet identifiers, matching the backend's payment_method_type strings.
 * Keyed as a map (rather than flat booleans) so new wallet types can be
 * added without changing the shape of `UseHyperswitchWalletsResult`.
 */
export type WalletType = 'google_pay' | 'apple_pay';

export interface WalletEligibility {
  /**
   * Whether the merchant's session actually supports this wallet (real
   * `allowed_payment_methods` eligibility) — device capability is a
   * separate, faster concern; see `useHyperswitchDeviceCapability`.
   */
  isEligible: boolean;
}

/** Absent entry (e.g. `wallets.apple_pay`) means "not eligible / not checked yet". */
export type WalletEligibilityMap = Partial<
  Record<WalletType, WalletEligibility>
>;

export interface UseHyperswitchWalletsResult {
  isLoading: boolean;
  wallets: WalletEligibilityMap;
}

export interface UseHyperswitchDeviceCapabilityOptions {
  /**
   * Card networks to probe for (e.g. `['VISA', 'MASTERCARD']`).
   * @default DEFAULT_GOOGLE_PAY_CARD_NETWORKS / DEFAULT_APPLE_PAY_NETWORKS
   */
  allowedCardNetworks?: string[];
}

export interface UseHyperswitchDeviceCapabilityResult {
  isLoading: boolean;
  isGooglePayCapable: boolean;
  isApplePayCapable: boolean;
}
