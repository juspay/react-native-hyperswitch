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

  isGooglePaySupported(): Promise<boolean>;

  isApplePaySupported(): Promise<boolean>;

  getWalletSession(params?: Object): Promise<string>;

  isWalletEligible(wallet: string): Promise<boolean>;

  launchWallet(wallet: string): Promise<string>;

  /* A new native session (client-core's PaymentSession): starts its prefetch surface and
     resolves its tag (-1 when there is none), which the session's calls pass back as
     `sessionTag`. updateIntent crosses the bridge in two calls: init resolves once the new
     authorization is needed, complete hands it over. */
  initPaymentSession(params: Object): Promise<number>;

  updateIntentInit(sessionTag: number): Promise<string>;

  updateIntentComplete(
    sessionTag: number,
    sdkAuthorization: string
  ): Promise<string>;
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
