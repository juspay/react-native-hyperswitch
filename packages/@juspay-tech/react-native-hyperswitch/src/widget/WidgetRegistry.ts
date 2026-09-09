import NativeWidgetHelperModule from '../codegen/modules/NativeWidgetHelperModule';
import { mapNativeResponseToPaymentResult } from '../native/NativeResponseMapper';
import type { PaymentResult } from '../types/paymentresult';

const widgetTags = new Map<string, number>();

export function registerWidget(widgetId: string, nativeViewTag: number): void {
  widgetTags.set(widgetId, nativeViewTag);
}

export function getWidget(widgetId: string): number | undefined {
  return widgetTags.get(widgetId);
}

export function unregisterWidget(widgetId: string): void {
  widgetTags.delete(widgetId);
}

/**
 * @deprecated Pass a `ref` to `<PaymentElement>` instead and call
 *             `elements.confirmPayment(ref)`. The widget-id (string) path
 *             exists only for backward compatibility and will be removed
 *             in the next major release.
 */
export function confirmPayment(widgetId: string): Promise<string> {
  const nativeTag = widgetTags.get(widgetId);
  if (nativeTag === undefined) {
    return Promise.resolve(
      JSON.stringify({
        status: 'failed',
        message: `Widget ${widgetId} not found or not mounted`,
        type: undefined,
      })
    );
  }
  return new Promise((resolve) => {
    NativeWidgetHelperModule.confirmPayment(nativeTag, resolve);
  });
}

/**
 * Destroys the native widget instance(s) cached for the given
 * `sdkAuthorization` (the key the widget is stored under). Live widgets
 * bound to any other authorization keep running untouched.
 *
 * After deinit, a fresh widget is created on demand — on the next
 * `sdkAuthorization` prop application or on the next mount. Pending
 * confirm/updateIntent promises for the destroyed widget are resolved with
 * a failed result instead of hanging.
 */
export function deinitWidget(sdkAuthorization: string): Promise<PaymentResult> {
  return new Promise((resolve) => {
    NativeWidgetHelperModule.deinitWidget(sdkAuthorization, (raw: string) =>
      resolve(mapNativeResponseToPaymentResult(raw))
    );
  });
}

export function updateIntentInitForAllWidgets(): Promise<PaymentResult[]> {
  const promises = [...widgetTags.values()].map(
    (tag) =>
      new Promise<PaymentResult>((resolve) => {
        NativeWidgetHelperModule.updateIntentInitForWidget(tag, (raw: string) =>
          resolve(mapNativeResponseToPaymentResult(raw))
        );
      })
  );
  return Promise.all(promises);
}

export function updateIntentCompleteForAllWidgets(
  sdkAuthorization: string
): Promise<PaymentResult[]> {
  const promises = [...widgetTags.values()].map(
    (tag) =>
      new Promise<PaymentResult>((resolve) => {
        NativeWidgetHelperModule.updateIntentCompleteForWidget(
          tag,
          sdkAuthorization,
          (raw: string) => resolve(mapNativeResponseToPaymentResult(raw))
        );
      })
  );
  return Promise.all(promises);
}
