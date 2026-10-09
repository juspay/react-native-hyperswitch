import type {
  HyperswitchConfiguration,
  PaymentSession,
  PaymentSessionConfiguration,
} from '../types/definitions';
import {
  updateIntentInitForAllWidgets,
  updateIntentCompleteForAllWidgets,
} from '../widget/WidgetRegistry';
import { Platform } from 'react-native';
import NativeHyperswitchModule from '../codegen/modules/NativeHyperswitchModule';
import {
  mapStatus,
  parseNativeResponse,
} from '../native/NativeResponseMapper';
import {
  bindGetCustomerSavedPaymentMethods,
  bindGetWalletSession,
  bindPresentPaymentSheet,
} from './binders';

export async function updateIntent(
  intentResolver: () => Promise<PaymentSessionConfiguration>,
  sessionTag?: number
): Promise<void> {
  if (Platform.OS === 'android') {
    return updateIntentOnSession(intentResolver, sessionTag ?? -1);
  }
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

/**
 * client-core's Elements.updateIntent: one round trip through the native session, which
 * refetches and switches every surface of the session in JS. An authorization the resolver
 * cannot produce is handed over as "", which ends the update as a failure.
 */
async function updateIntentOnSession(
  intentResolver: () => Promise<PaymentSessionConfiguration>,
  sessionTag: number
): Promise<void> {
  const init = parseNativeResponse(
    await NativeHyperswitchModule.updateIntentInit(sessionTag)
  );
  if (mapStatus(init.status) !== 'completed') {
    return;
  }
  let sdkAuthorization = '';
  try {
    sdkAuthorization = (await intentResolver())?.sdkAuthorization ?? '';
  } catch {
    sdkAuthorization = '';
  }
  await NativeHyperswitchModule.updateIntentComplete(
    sessionTag,
    sdkAuthorization
  );
}

export function createPaymentSession(
  hyperswitchConfig: HyperswitchConfiguration,
  paymentSessionConfig: PaymentSessionConfiguration,
  sessionTag?: number
): PaymentSession {
  const bindings = { hyperswitchConfig, paymentSessionConfig, sessionTag };
  return {
    presentPaymentSheet: bindPresentPaymentSheet(bindings),
    getCustomerSavedPaymentMethods:
      bindGetCustomerSavedPaymentMethods(bindings),
    getWalletSession: bindGetWalletSession(bindings),
    updateIntent: (intentResolver) =>
      updateIntent(
        intentResolver as () => Promise<PaymentSessionConfiguration>,
        sessionTag
      ),
  };
}
