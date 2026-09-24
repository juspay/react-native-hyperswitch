import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  UIManager,
  findNodeHandle,
  type ViewStyle,
  Platform,
} from 'react-native';
import NativePaymentWidgetImpl from './PaymentWidgetBridge';
import { registerWidget, unregisterWidget } from '../widget/WidgetRegistry';
import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import { useHyperElementsContext } from '../context/HyperElements';
import {
  makeUnknownEventWarningPayload,
  validateSubscribedEventStrings,
} from '../utils/EventValidator';
import type {
  PaymentEventNative,
  NativeEventEnvelope,
  PaymentEventResult,
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
  onChange?: (event: PaymentEventResult) => void;
  onReady?: () => void;
  style?: ViewStyle;
};

export const PaymentElement = forwardRef<
  PaymentElementHandle,
  PaymentElementProps
>((props, ref) => {
  const { widgetId, options, onPaymentResult, onChange, onReady, style } =
    props;
  const { paymentSessionConfig, hyperswitchConfig } = useHyperElementsContext();
  const viewRef = useRef(null);
  const viewTag = useNativeViewTag(viewRef, onReady);

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

  const warningEmitted = useRef(false);

  useEffect(() => {
    if (!options || !onChange || warningEmitted.current) {
      return;
    }
    const subscribedEvents = options.subscribedEvents as string[] | undefined;

    const invalidEvents = validateSubscribedEventStrings(subscribedEvents);
    if (invalidEvents.length > 0) {
      warningEmitted.current = true;
      const warningPayload = makeUnknownEventWarningPayload(invalidEvents);
      onChange({
        eventName: 'UNKNOWN_EVENT_SUBSCRIBED',
        payload: JSON.stringify({
          message: warningPayload.message,
          invalidEvents: warningPayload.invalidEvents,
          validEvents: warningPayload.validEvents,
        }),
      });
    }
  }, [options, onChange]);

  const onPaymentResultInternal = (
    event: NativeEventEnvelope & {
      nativeEvent: {
        eventName: string;
        payload: string;
        target: number;
      };
    }
  ) => {
    onPaymentResult(
      mapNativeResponseToPaymentResult(
        Platform.OS === 'ios'
          ? (event.nativeEvent.result ?? '')
          : (event.nativeEvent.payload ?? '')
      )
    );
  };

  const onPaymentEventInternal = (event: PaymentEventNative) => {
    onChange?.(event.nativeEvent);
  };

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
        configuration: options as Record<string, unknown> | undefined,
      }}
      style={{ ...style, flex: 1 }}
    />
  );
});
