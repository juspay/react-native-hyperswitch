import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

export type CustomEndpoints = Object;

export interface Spec extends TurboModule {
  initialise(
    publishableKey: string,
    platformPublishableKey: string,
    profileId: string,
    environment: string,
    customEndpoints: CustomEndpoints
  ): Promise<string>;

  presentPaymentSheet(params: Object): Promise<string>;

  getCustomerSavedPaymentMethods(params?: Object): Promise<string>;

  getCustomerLastUsedPaymentMethodData(): Promise<string>;

  getCustomerDefaultSavedPaymentMethodData(): Promise<string>;

  getCustomerSavedPaymentMethodData(): Promise<string>;

  confirmWithCustomerLastUsedPaymentMethod(reactTag: number): Promise<string>;

  confirmWithCustomerDefaultPaymentMethod(reactTag: number): Promise<string>;

  confirmWithCustomerPaymentToken(
    reactTag: number,
    token: string
  ): Promise<string>;

  /**
   * Android only. Resolves `false` on iOS.
   * Checks device-level Google Pay readiness via Play Services'
   * `PaymentsClient.isReadyToPay`, given a Google Pay `IsReadyToPayRequest`
   * JSON string (see `buildGooglePayIsReadyToPayRequest` in
   * `utils/WalletAvailability`).
   */
  checkGooglePayReadiness(isReadyToPayRequestJson: string): Promise<boolean>;

  /**
   * iOS only. Resolves `false` on Android.
   * Checks device-level Apple Pay readiness via
   * `PKPaymentAuthorizationController.canMakePayments(usingNetworks:)`,
   * given a JSON array of PassKit network name strings (see
   * `buildApplePaySupportedNetworks` in `utils/WalletAvailability`).
   */
  checkApplePayReadiness(supportedNetworksJson: string): Promise<boolean>;
}

/**
 * Use `TurboModuleRegistry.get` first for new-arch TurboModules, and fall back
 * to `NativeModules` for legacy/old-arch support.
 */
const NativeHyperswitchModule =
  TurboModuleRegistry.get<Spec>('NativeHyperswitchModule') ??
  NativeModules.NativeHyperswitchModule;

export default NativeHyperswitchModule as Spec;
export { NativeHyperswitchModule };
