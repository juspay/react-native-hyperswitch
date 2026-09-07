import NativeHyperswitchPaypal from './NativeHyperswitchPaypal';

// TurboModuleRegistry.get resolves the TurboModule on the new architecture
// and falls back to the legacy NativeModules entry on the old architecture,
// so this single code path supports both.
export const isAvailable = NativeHyperswitchPaypal != null;

import PaypalButtonNativeComponent from './PaypalButtonNativeComponent';

export const PaypalButton = PaypalButtonNativeComponent;
export type {NativeProps as PaypalButtonProps} from './PaypalButtonNativeComponent';

export type PayPalResult = {
  status: string;
  orderId?: string;
  payerId?: string;
  error_message?: string;
};

export type PayPalRequest = {
  clientId: string;
  environment?: 'SANDBOX' | 'PRODUCTION';
  orderId: string;
  returnUrl?: string;
  fundingSource?: 'PAYPAL' | 'PAY_LATER' | 'PAYPAL_CREDIT';
};

export function launchPayPal(
  requestObj: string,
  callback: (result: PayPalResult) => void
): void {
  if (!NativeHyperswitchPaypal) {
    callback({
      status: 'failed',
      error_message: 'PayPal module not available',
    });
    return;
  }
  return NativeHyperswitchPaypal.launchPayPal(requestObj, callback);
}
