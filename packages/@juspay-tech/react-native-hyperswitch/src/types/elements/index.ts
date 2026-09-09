import { PaymentResult } from '../paymentresult';
import type {
  HyperswitchConfiguration,
  PaymentElementHandle,
  PaymentSessionConfiguration,
} from '../definitions';
import {
  CustomerSavedPaymentMethodsSession,
  SavedPaymentMethodsConfiguration,
} from '../savedPaymentMethods';
import { PaymentSheetConfiguration } from '../PaymentSheetConfiguration';

export interface Elements {
  hyperswitchConfig: HyperswitchConfiguration;
  confirmPayment(
    paymentElementRef: { current: PaymentElementHandle | null } | string,
    options?: { confirmParams?: Record<string, any> }
  ): Promise<PaymentResult>;
  presentPaymentSheet(
    configuration?: PaymentSheetConfiguration
  ): Promise<PaymentResult>;
  updateIntent(
    intentResolver: () => Promise<PaymentSessionConfiguration>
  ): Promise<void>;
  /**
   * Destroys the native widget instance cached for the given
   * `sdkAuthorization`. Widgets for other authorizations keep running.
   * A fresh widget is re-created on demand on the next mount/prop update.
   */
  deinitWidget(sdkAuthorization: string): Promise<PaymentResult>;
  getCustomerSavedPaymentMethods(
    options?: SavedPaymentMethodsConfiguration
  ): Promise<CustomerSavedPaymentMethodsSession>;
}

/**
 * @deprecated Legacy alias for the action subset of {@link Elements}; not
 *             consumed internally. Kept for source compatibility.
 */
export interface ElementsActions {
  confirmPayment: (
    paymentElementRef: { current: PaymentElementHandle | null } | string,
    options?: { confirmParams?: Record<string, any> }
  ) => Promise<PaymentResult>;
  updateIntent: (
    intentResolver: () => Promise<PaymentSessionConfiguration>
  ) => Promise<void>;
  deinitWidget: (sdkAuthorization: string) => Promise<PaymentResult>;
  getCustomerSavedPaymentMethods(): Promise<CustomerSavedPaymentMethodsSession>;
}
