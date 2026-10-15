/** Result payload delivered by the widget bridge for a single payment attempt. */

import type { ViewStyle } from 'react-native';
import type {
  HyperswitchConfiguration,
  PaymentSessionConfiguration,
} from './definitions';
import type { SubscriptionEvent } from './PaymentSheetConfiguration';

/** Result payload delivered by the widget bridge for a single payment attempt. */
export type PaymentResultNative = {
  status?: string;
  errorMessage?: string;
};



/** Payload of `cardDetailsChange`. */
export type CardInfo = {
  bin: string | undefined;
  extendedBin?: string;
  last4: string | undefined;
  brand: string | undefined;
  expiryMonth: string | undefined;
  expiryYear: string | undefined;
  formattedExpiry: string | undefined;
  isCardNumberComplete: boolean;
  isCvcComplete: boolean;
  isExpiryComplete: boolean;
  isCardNumberValid: boolean;
  isExpiryValid: boolean;
};

export type PaymentMethodStatusEvent = {
  paymentMethod: string;
  paymentMethodType: string;
  isSavedPaymentMethod: boolean;
  isOneClickWallet: boolean;
};

export type FormStatusEvent = { status: string };

export type PaymentMethodInfoAddress = {
  country: string;
  state: string;
  postalCode: string;
};

/** Payload of `cvcStatusChange`; the status is nested under `cvcStatus`. */
export type CvcStatusEvent = {
  cvcStatus: {
    isCvcEmpty: boolean;
    isCvcComplete: boolean;
  };
};

/**
 * Delivered to `onChange` for every event listed in `subscriptionEvents`;
 * branch on `eventName`.
 */
export type PaymentEvent = {
  eventName: SubscriptionEvent | (string & {});
  payload: Record<string, unknown>;
};


/** Wire shape from native: `payload` is a JSON string (codegen constraint). */
export type PaymentEventWire = {
  eventName: string;
  payload: string;
};

/** React Native codegen envelope wrapping {@link PaymentEventWire}. */
export type PaymentEventNative = { nativeEvent: PaymentEventWire };

/** Raw string payload delivered by the widget's `onPaymentResult` callback. */
export type PaymentResultInternal = { result?: string };

/** React Native codegen envelope wrapping {@link PaymentResultInternal}. */
export type NativeEventEnvelope = { nativeEvent: PaymentResultInternal };

/** Props expected by the underlying native widget component (old and new arch). */
export type NativePaymentWidgetPropTypes = {
  ref?: React.Ref<unknown>;
  widgetType?: string;
  sdkAuthorization?: string;
  options?: {
    hyperswitchConfig?: HyperswitchConfiguration;
    paymentSessionConfig?: PaymentSessionConfiguration;
    configuration?: Record<string, unknown>;
  };
  onPaymentResult?: (event: NativeEventEnvelope & { nativeEvent: {
  eventName: string;
  payload: string;
  target: number;
}}) => void;
  style?: ViewStyle;
  onPaymentEvent?: (event: PaymentEventNative) => void;
};
