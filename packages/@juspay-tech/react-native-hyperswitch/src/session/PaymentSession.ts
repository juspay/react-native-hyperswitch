import type {
  HyperswitchConfiguration,
  PaymentSession,
  PaymentSessionConfiguration,
} from '../types/definitions';
import {
  updateIntentInitForAllWidgets,
  updateIntentCompleteForAllWidgets,
} from '../widget/WidgetRegistry';
import {
  bindGetCustomerSavedPaymentMethods,
  bindGetWalletSession,
  bindPresentPaymentSheet,
} from './binders';

export async function updateIntent(
  intentResolver: () => Promise<PaymentSessionConfiguration>
): Promise<void> {
  let newIntent: PaymentSessionConfiguration;
  try {
    await updateIntentInitForAllWidgets();
    newIntent = await intentResolver();
    await updateIntentCompleteForAllWidgets(newIntent.sdkAuthorization);
  } catch {
    await updateIntentCompleteForAllWidgets('');
    return;
  }
}

export function createPaymentSession(
  hyperswitchConfig: HyperswitchConfiguration,
  paymentSessionConfig: PaymentSessionConfiguration
): PaymentSession {
  const bindings = { hyperswitchConfig, paymentSessionConfig };
  return {
    presentPaymentSheet: bindPresentPaymentSheet(bindings),
    getCustomerSavedPaymentMethods:
      bindGetCustomerSavedPaymentMethods(bindings),
    getWalletSession: bindGetWalletSession(bindings),
    updateIntent,
  };
}
