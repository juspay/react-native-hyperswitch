import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';

export type CustomEndpoints = Object;
/* A tap names its message: `paymentMethodType` is empty when the shown text is the payment
   method's own message, `index` is the segment's position in that message's `value`, and
   `text` is what it showed. */
export type MessageActionEvent = {
  paymentMethod: string;
  paymentMethodType: string;
  index: number;
  text: string;
};

export interface Spec extends TurboModule {
  initialise(
    publishableKey: string,
    platformPublishableKey: string,
    profileId: string,
    environment: string,
    customEndpoints: CustomEndpoints
  ): Promise<string>;

  presentPaymentSheet(params: Object): Promise<string>;
  readonly onPaymentSheetMessageAction: EventEmitter<MessageActionEvent>;

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
