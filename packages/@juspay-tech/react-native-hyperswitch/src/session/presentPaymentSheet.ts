import NativeHyperswitchModule from '../codegen/modules/NativeHyperswitchModule';
import type { NativePaymentSheetPayload } from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import { mapNativeResponseToPaymentResult } from '../native/NativeResponseMapper';
import {
  isInitializing,
  isSheetPresented,
  setSheetPresented,
} from '../native/InitializationState';
import { normalizeSubscribedEvents } from '../utils/EventValidator';

/**
 * Low-level wrapper over `NativeHyperswitchModule.presentPaymentSheet`.
 *
 * Guards against two failure modes that silently confused merchants in
 * older SDK versions:
 *   1. Opening a sheet while `loadHyper()` is still initialising returns a
 *      "initialization_in_progress" failure instead of passing an
 *      inconsistent state to the native side.
 *   2. A second call while a sheet is already presented (fast-refresh,
 *      developer mistake) short-circuits to "sheet_already_presented"
 *      instead of stacking a duplicate.
 */
export async function presentPaymentSheetWithPayload(
  payload: NativePaymentSheetPayload
): Promise<PaymentResult> {
  if (isInitializing()) {
    return {
      status: 'failed',
      type: 'initialization_in_progress',
      message:
        'SDK is reloading. Please wait for initialisation to complete before presenting the payment sheet.',
    };
  }
  if (isSheetPresented()) {
    // A sheet is already open (e.g. a hot-reload fired while the sheet was
    // visible). Silently skip so the existing sheet is not covered by a
    // new one.
    return {
      status: 'canceled',
      type: 'sheet_already_presented',
      message: 'A payment sheet is already presented.',
    };
  }
  setSheetPresented(true);
  try {
    const configuration = payload.configuration
      ? {
          ...payload.configuration,
          /* Normalize legacy subscription names to the bundle's camelCase
             taxonomy before they reach native. */
          ...(payload.configuration.subscribedEvents
            ? {
                subscribedEvents: normalizeSubscribedEvents(
                  payload.configuration.subscribedEvents as string[]
                ),
              }
            : {}),
        }
      : payload.configuration;
    const raw = await NativeHyperswitchModule.presentPaymentSheet({
      hyperswitchConfig: payload.hyperswitchConfig,
      paymentSessionConfig: payload.paymentSessionConfig,
      configuration,
    });
    return mapNativeResponseToPaymentResult(raw);
  } finally {
    setSheetPresented(false);
  }
}
