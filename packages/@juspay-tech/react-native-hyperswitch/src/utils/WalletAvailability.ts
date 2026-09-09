/**
 * Default request builders for the device-level wallet readiness checks
 * (`NativeHyperswitchModule.checkGooglePayReadiness` /
 * `checkApplePayReadiness`).
 *
 * These are generic, non-merchant-specific requests — they answer "can this
 * device pay with this wallet at all", mirroring the base `IsReadyToPayRequest`
 * Google's own docs recommend for a pre-checkout eligibility check. They do
 * NOT reflect which wallets the merchant's profile/connectors actually
 * support — that requires `SESSION_BASED` mode (see `useHyperswitchWallets`).
 */

export const DEFAULT_GOOGLE_PAY_CARD_NETWORKS = [
  'AMEX',
  'DISCOVER',
  'JCB',
  'MASTERCARD',
  'VISA',
];

export const DEFAULT_GOOGLE_PAY_AUTH_METHODS = ['PAN_ONLY', 'CRYPTOGRAM_3DS'];

export const DEFAULT_APPLE_PAY_NETWORKS = [
  'visa',
  'masterCard',
  'amex',
  'discover',
];

/**
 * Builds the JSON string for a base Google Pay `IsReadyToPayRequest`
 * (https://developers.google.com/pay/api/android/reference/request-objects#IsReadyToPayRequest).
 */
export function buildGooglePayIsReadyToPayRequest(
  allowedCardNetworks: string[] = DEFAULT_GOOGLE_PAY_CARD_NETWORKS,
  allowedAuthMethods: string[] = DEFAULT_GOOGLE_PAY_AUTH_METHODS
): string {
  return JSON.stringify({
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [
      {
        type: 'CARD',
        parameters: {
          allowedAuthMethods,
          allowedCardNetworks,
        },
      },
    ],
  });
}

/**
 * Builds the JSON array string of PassKit network names
 * (https://developer.apple.com/documentation/passkit/pkpaymentnetwork)
 * consumed by `canMakePayments(usingNetworks:)`.
 */
export function buildApplePaySupportedNetworks(
  networks: string[] = DEFAULT_APPLE_PAY_NETWORKS
): string {
  return JSON.stringify(networks);
}
