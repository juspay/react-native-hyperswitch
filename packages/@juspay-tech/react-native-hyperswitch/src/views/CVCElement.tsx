import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { useHyperElementsContext } from '../context/HyperElements';
import type { CvcWidgetOptions } from '../types/definitions';
import { registerWidget, unregisterWidget } from '../widget/WidgetRegistry';
import type {
  PaymentEvent,
  PaymentEventNative,
} from '../types/NativeEventTypes';
import type { SavedMethodCustomization } from '../types/PaymentSheetConfiguration';
import NativePaymentWidgetImpl from './PaymentWidgetBridge';
import { useNativeViewTag } from './useNativeViewTag';
import { PaymentResult } from '../types/paymentresult';
import {
  routeWidgetEvent,
  withNativeSubscription,
} from '../utils/EventValidator';

type CVCElementProps = {
  id?: string;
  options?: CvcWidgetOptions;
  /** Receives every event listed in `options.subscriptionEvents`; branch on `event.eventName`. */
  onChange?: (event: PaymentEvent) => void;
  /** Fires when the CVC input gains focus; no subscription needed. */
  onFocus?: () => void;
  /** Fires once the widget has rendered (it makes no API calls); no subscription needed. */
  onReady?: () => void;
  /** Fires when the CVC input loses focus; no subscription needed. */
  onBlur?: () => void;
  onPaymentResult?: (result: PaymentResult) => void;
  style?: ViewStyle;
};

type CVCWidgetRef = {
  confirmPayment: () => Promise<PaymentResult>;
};

function parsePaymentResult(result: string): PaymentResult {
  return JSON.parse(result);
}

export const CVCElement = forwardRef<CVCWidgetRef, CVCElementProps>(
  (props, _ref) => {
    const {
      id,
      options,
      onChange,
      onFocus,
      onBlur,
      onPaymentResult,
      style,
      onReady,
    } = props;
    const { paymentSessionConfig, hyperswitchConfig } =
      useHyperElementsContext();
    const viewRef = useRef(null);
    const viewTag = useNativeViewTag(viewRef);

    const shouldRegister = id !== undefined && viewTag !== undefined;
    useEffect(() => {
      if (!shouldRegister) return undefined;
      const widgetId = id as string;
      const tag = viewTag as number;
      registerWidget(widgetId, tag);
      return () => unregisterWidget(widgetId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldRegister]);

    const nativeOptions = useMemo(() => {
      const opts = options as
        | (CvcWidgetOptions & {
            paymentMethodLayout?: {
              savedMethodCustomization?: SavedMethodCustomization;
            };
          })
        | undefined;
      const layout = opts?.paymentMethodLayout;
      return {
        ...withNativeSubscription(opts ?? {}),
        paymentMethodLayout: {
          ...layout,
          savedMethodCustomization: {
            ...layout?.savedMethodCustomization,
            cvcIcon: opts?.cvcIcon ?? 'shown',
          },
        },
      };
    }, [options]);

    const onPaymentEventInternal = (event: PaymentEventNative) => {
      routeWidgetEvent(event.nativeEvent, {
        onChange,
        onReady,
        onFocus,
        onBlur,
      });
    };

    const onPaymentResultInternal = (event: {
      nativeEvent: { result?: string };
    }) => {
      onPaymentResult?.(parsePaymentResult(event.nativeEvent.result ?? ''));
    };

    return (
      <NativePaymentWidgetImpl
        ref={viewRef}
        widgetType="cvcWidget"
        sdkAuthorization={paymentSessionConfig?.sdkAuthorization ?? ''}
        onPaymentEvent={onPaymentEventInternal}
        onPaymentResult={onPaymentResultInternal}
        options={{
          hyperswitchConfig: hyperswitchConfig || undefined,
          paymentSessionConfig: paymentSessionConfig || undefined,
          configuration: nativeOptions as Record<string, unknown>,
        }}
        style={style}
      />
    );
  }
);
