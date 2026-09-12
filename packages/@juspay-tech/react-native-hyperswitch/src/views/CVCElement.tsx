import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { useHyperElementsContext } from '../context/HyperElements';
import type { CvcWidgetOptions } from '../types/definitions';
import { registerWidget, unregisterWidget } from '../widget/WidgetRegistry';
import type {
  PaymentEventNative,
  PaymentEventResult,
} from '../types/NativeEventTypes';
import type { SavedMethodCustomization } from '../types/PaymentSheetConfiguration';
import NativePaymentWidgetImpl from './PaymentWidgetBridge';
import { useNativeViewTag } from './useNativeViewTag';
import { PaymentResult } from '../types/paymentresult';

type CVCElementProps = {
  id?: string;
  options?: CvcWidgetOptions;
  onChange?: (event: PaymentEventResult) => void;
  onFocus?: () => void;
  onReady?: () => void;
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
    const viewTag = useNativeViewTag(viewRef, onReady);

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
        ...opts,
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
      onChange?.(event.nativeEvent);

      if (event.nativeEvent.eventName === 'cvcStatusChange') {
        try {
          const payloadString = event.nativeEvent.payload;
          const outerDict = (
            typeof payloadString === 'string'
              ? JSON.parse(payloadString)
              : payloadString
          ) as Record<string, unknown> | undefined;
          if (!outerDict) {
            return;
          }
          const cvcStatus = outerDict.cvcStatus as
            Record<string, unknown> | undefined;
          if (!cvcStatus) {
            return;
          }
          const isCvcFocused = Boolean(cvcStatus.isCvcFocused);
          const isCvcBlur = Boolean(cvcStatus.isCvcBlur);
          if (isCvcFocused) {
            onFocus?.();
          }
          if (isCvcBlur) {
            onBlur?.();
          }
        } catch {
          // Ignore malformed native events
        }
      }
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
