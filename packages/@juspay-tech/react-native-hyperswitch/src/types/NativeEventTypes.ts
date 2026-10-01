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

/** @deprecated Use {@link PaymentResultNative}. */
export type paymentResult = PaymentResultNative;

/** @deprecated Use {@link PaymentResultNative}. */
export type paymentResultEvent = PaymentResultNative;

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
/** @deprecated Use {@link CardInfo}. */
export type cardInfo = CardInfo;

export type PaymentMethodStatusEvent = {
  paymentMethod: string;
  paymentMethodType: string;
  isSavedPaymentMethod: boolean;
  isOneClickWallet: boolean;
};
/** @deprecated Use {@link PaymentMethodStatusEvent}. */
export type paymentMethodStatusEvent = PaymentMethodStatusEvent;

export type FormStatusEvent = { status: string };
/** @deprecated Use {@link FormStatusEvent}. */
export type formStatusEvent = FormStatusEvent;

export type PaymentMethodInfoAddress = {
  country: string;
  state: string;
  postalCode: string;
};
/** @deprecated Use {@link PaymentMethodInfoAddress}. */
export type paymentMethodInfoAddress = PaymentMethodInfoAddress;

/** Payload of `cvcStatusChange`; the status is nested under `cvcStatus`. */
export type CvcStatusEvent = {
  cvcStatus: {
    isCvcEmpty: boolean;
    isCvcComplete: boolean;
  };
};
/** @deprecated Use {@link CvcStatusEvent}. */
export type cvcStatusEvent = CvcStatusEvent;

/**
 * Delivered to `onChange` for every event listed in `subscriptionEvents`;
 * branch on `eventName`.
 */
export type PaymentEvent = {
  eventName: SubscriptionEvent | (string & {});
  payload: Record<string, unknown>;
};

/**
 * @deprecated Use {@link PaymentEvent}. Breaking: `payload` is now a parsed
 * object, no longer a JSON string, so drop any `JSON.parse(event.payload)`.
 */
export type PaymentEventResult = PaymentEvent;
/** @deprecated Use {@link PaymentEvent}. Breaking: `payload` is now an object. */
export type paymentEventResult = PaymentEvent;

/** Wire shape from native: `payload` is a JSON string (codegen constraint). */
export type PaymentEventWire = {
  eventName: string;
  payload: string;
};

/** React Native codegen envelope wrapping {@link PaymentEventWire}. */
export type PaymentEventNative = { nativeEvent: PaymentEventWire };
/** @deprecated Use {@link PaymentEventNative}. */
export type paymentEventNative = PaymentEventNative;

/** Raw string payload delivered by the widget's `onPaymentResult` callback. */
export type PaymentResultInternal = { result?: string };
/** @deprecated Use {@link PaymentResultInternal}. */
export type paymentResultInternal = PaymentResultInternal;

/** React Native codegen envelope wrapping {@link PaymentResultInternal}. */
export type NativeEventEnvelope = { nativeEvent: PaymentResultInternal };
/** @deprecated Use {@link NativeEventEnvelope}. */
export type nativeEvent = NativeEventEnvelope;

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
/** @deprecated Use {@link NativePaymentWidgetPropTypes}. */
export type nativePaymentWidgetType = NativePaymentWidgetPropTypes;
