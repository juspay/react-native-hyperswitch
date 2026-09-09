import type {
  HyperswitchConfiguration,
  PaymentElementHandle,
  PaymentSessionConfiguration,
} from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import type { Elements } from '../types/elements';
import { mapNativeResponseToPaymentResult } from '../native/NativeResponseMapper';
import {
  confirmPayment as confirmWidgetPayment,
  deinitWidget,
} from '../widget/WidgetRegistry';
import { updateIntent } from './PaymentSession';
import {
  bindGetCustomerSavedPaymentMethods,
  bindPresentPaymentSheet,
} from './binders';

type ElementsNativeActions = Pick<
  Elements,
  | 'confirmPayment'
  | 'presentPaymentSheet'
  | 'getCustomerSavedPaymentMethods'
  | 'updateIntent'
  | 'deinitWidget'
>;

export function createElementsNativeActions(
  hyperswitchConfig: HyperswitchConfiguration,
  paymentSessionConfig: PaymentSessionConfiguration
): ElementsNativeActions {
  const bindings = { hyperswitchConfig, paymentSessionConfig };
  return {
    presentPaymentSheet: bindPresentPaymentSheet(bindings),

    async confirmPayment(
      paymentElementRef: { current: PaymentElementHandle | null } | string,
      confirmOptions?: { confirmParams?: Record<string, any> }
    ): Promise<PaymentResult> {
      if (typeof paymentElementRef === 'string') {
        const result = await confirmWidgetPayment(paymentElementRef);
        return mapNativeResponseToPaymentResult(result);
      }

      const ref = paymentElementRef.current;
      if (!ref) {
        throw new Error('PaymentElement reference is not mounted');
      }
      return ref.confirmPayment(confirmOptions);
    },

    getCustomerSavedPaymentMethods:
      bindGetCustomerSavedPaymentMethods(bindings),

    updateIntent,

    deinitWidget,
  };
}

export function createElements(
  hyperswitchConfig: HyperswitchConfiguration,
  paymentSessionConfig: PaymentSessionConfiguration
): Elements {
  return {
    hyperswitchConfig,
    ...createElementsNativeActions(hyperswitchConfig, paymentSessionConfig),
  };
}
