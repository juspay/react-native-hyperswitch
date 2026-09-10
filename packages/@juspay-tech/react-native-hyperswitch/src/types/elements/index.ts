import type { WalletSessionHandle } from '../walletSession';
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
  getCustomerSavedPaymentMethods(
    options?: SavedPaymentMethodsConfiguration
  ): Promise<CustomerSavedPaymentMethodsSession>;
  getWalletSession(): Promise<WalletSessionHandle>;
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
  getCustomerSavedPaymentMethods(): Promise<CustomerSavedPaymentMethodsSession>;
}
