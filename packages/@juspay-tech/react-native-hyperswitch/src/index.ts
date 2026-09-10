import type {
  HyperswitchConfiguration,
  PaymentSession,
  PaymentSessionConfiguration,
  HyperswitchSession,
} from './types/definitions';
export type * from './types/savedPaymentMethods';
export type * from './types/walletSession';
export type * from './types/definitions';
export type * from './types/elements';
export type * from './types/NativeEventTypes';
export type * from './types/PaymentSheetConfiguration';
export type * from './types/paymentresult';
import NativeHyperswitchModule from './codegen/modules/NativeHyperswitchModule';
import { createPaymentSession } from './session/PaymentSession';
import { Elements } from './types/elements';
import { createElements } from './session/Elements';
import { setInitializing } from './native/InitializationState';

export function loadHyper(
  config: HyperswitchConfiguration
): Promise<HyperswitchSession> {
  setInitializing(true);
  return NativeHyperswitchModule.initialise(
    config.publishableKey,
    config.platformPublishableKey ?? '',
    config.profileId ?? '',
    config.environment ?? 'PROD',
    config.customEndpoints ?? {}
  )
    .then(() => {
      setInitializing(false);
      return {
        publishableKey: config.publishableKey,
        async initPaymentSession(
          options: PaymentSessionConfiguration
        ): Promise<PaymentSession> {
          return createPaymentSession(config, options);
        },
        async elements(
          options: PaymentSessionConfiguration
        ): Promise<Elements> {
          return createElements(config, options);
        },
      };
    })
    .catch((error) => {
      setInitializing(false);
      console.error('Error initializing Hyperswitch SDK:', error);
      throw error;
    });
}

export const Hyperswitch = {
  init: loadHyper,
};

export default Hyperswitch;

export {
  HyperElements,
  usePaymentSession,
  useWalletSession,
  useElements,
  useElements as useWidgets,
} from './context/HyperElements';

export { CVCElement as CardCVCElement } from './views/CVCElement';

export { PaymentElement } from './views/PaymentElement';

export {
  isPlatformPaySupported,
  isGooglePaySupported,
  isApplePaySupported,
  isWalletSupported,
} from './session/PlatformPaySupport';

export { GooglePayButton } from './views/GooglePayButton';
export type { GooglePayButtonProps } from './views/GooglePayButton';

export { ApplePayButton } from './views/ApplePayButton';
export type { ApplePayButtonProps } from './views/ApplePayButton';