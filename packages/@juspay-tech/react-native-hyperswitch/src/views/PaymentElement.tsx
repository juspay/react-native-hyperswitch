import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { UIManager, findNodeHandle, type ViewStyle, Platform } from 'react-native';
import NativePaymentWidgetImpl from './PaymentWidgetBridge';
import { registerWidget, unregisterWidget } from '../widget/WidgetRegistry';
import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import { useHyperElementsContext } from '../context/HyperElements';
import {
  routeWidgetEvent,
  withNativeSubscription,
} from '../utils/EventValidator';
import type {
  PaymentEvent,
  PaymentEventNative,
  NativeEventEnvelope,
} from '../types/NativeEventTypes';
import type { PaymentElementHandle } from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import { mapNativeResponseToPaymentResult } from '../native/NativeResponseMapper';
import NativeWidgetHelperModule from '../codegen/modules/NativeWidgetHelperModule';
import { useNativeViewTag } from './useNativeViewTag';

type PaymentElementProps = {
  widgetId: string;
  options?: PaymentSheetConfiguration;
  onPaymentResult: (result: PaymentResult) => void;
  /** Receives every event listed in `options.subscriptionEvents`; branch on `event.eventName`. */
  onChange?: (event: PaymentEvent) => void;
  /** Fires once the element has finished its initial loading (success or error); no subscription needed. */
  onReady?: () => void;
  /** Fires when focus enters the element (moving between its fields does not re-fire); no subscription needed. */
  onFocus?: () => void;
  /** Fires when focus leaves the element entirely (moving between its fields does not fire); no subscription needed. */
  onBlur?: () => void;
  style?: ViewStyle;
};

export const PaymentElement = forwardRef<
  PaymentElementHandle,
  PaymentElementProps
>((props, ref) => {
  const {
    widgetId,
    options,
    onPaymentResult,
    onChange,
    onReady,
    onFocus,
    onBlur,
    style,
  } = props;
  const { paymentSessionConfig, hyperswitchConfig } = useHyperElementsContext();
  const viewRef = useRef(null);
  const viewTag = useNativeViewTag(viewRef);

  useEffect(() => {
    if (viewTag === undefined) return undefined;
    registerWidget(widgetId, viewTag);
    return () => unregisterWidget(widgetId);
  }, [viewTag, widgetId]);

  // Old-arch view manager command "1": tells the native view to attach itself
  // to the active payment session. Without it the widget mounts but renders
  // an empty container on Paper.
  useEffect(() => {
    if (viewTag !== undefined) {
      UIManager.dispatchViewManagerCommand(viewTag, 1, []);
    }
  }, [viewTag]);

  useImperativeHandle(
    ref,
    () => ({
      confirmPayment: (_options?: {
        confirmParams?: Record<string, any>;
      }): Promise<PaymentResult> => {
        if (viewRef.current == null) {
          return Promise.resolve({
            status: 'failed',
            type: 'widget_not_ready',
            message: 'Widget not ready',
          });
        }
        const id =
          findNodeHandle(
            viewRef.current as Parameters<typeof findNodeHandle>[0]
          ) ?? -1;
        if (id === -1) {
          return Promise.resolve({
            status: 'failed',
            type: 'widget_not_ready',
            message: 'Unable to find native view handle',
          });
        }
        return new Promise<PaymentResult>((resolve) => {
          NativeWidgetHelperModule.confirmPayment(id, (raw) => {
            resolve(mapNativeResponseToPaymentResult(raw));
          });
        });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewTag]
  );

  const onPaymentResultInternal = (event: NativeEventEnvelope & { nativeEvent: {
  eventName: string;
  payload: string;
  target: number;
}}) => {
    onPaymentResult(
      mapNativeResponseToPaymentResult(
        Platform.OS === 'ios'
          ? event.nativeEvent.result ?? ""
          : event.nativeEvent.payload ?? ""
      )
    );
  };

  const onPaymentEventInternal = (event: PaymentEventNative) => {
    routeWidgetEvent(event.nativeEvent, { onChange, onReady, onFocus, onBlur });
  };

  const configuration = options
    ? (withNativeSubscription(options) as Record<string, unknown>)
    : undefined;

  return (
    <NativePaymentWidgetImpl
      ref={viewRef}
      sdkAuthorization={paymentSessionConfig?.sdkAuthorization ?? ''}
      widgetType="widgetPaymentSheet"
      onPaymentEvent={onPaymentEventInternal}
      onPaymentResult={onPaymentResultInternal}
      options={{
        hyperswitchConfig: hyperswitchConfig || undefined,
        paymentSessionConfig: paymentSessionConfig || undefined,
        configuration,
      }}
      style={{ ...style, flex: 1 }}
    />
  );
});
