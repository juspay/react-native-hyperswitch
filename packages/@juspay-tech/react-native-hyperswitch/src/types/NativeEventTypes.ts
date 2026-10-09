/** Result payload delivered by the widget bridge for a single payment attempt. */

import type { ViewStyle } from 'react-native';
import type {
  HyperswitchConfiguration,
  PaymentSessionConfiguration,
} from './definitions';

/** Result payload delivered by the widget bridge for a single payment attempt. */
export type PaymentResultNative = {
  status?: string;
  errorMessage?: string;
};

/** @deprecated Use {@link PaymentResultNative}. */
export type paymentResult = PaymentResultNative;

/** @deprecated Use {@link PaymentResultNative}. */
export type paymentResultEvent = PaymentResultNative;

/** Card metadata emitted by the card widget for `CARD_STATUS`-style events. */
export type CardInfo = {
  bin: string | undefined;
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

export type CvcStatusEvent = {
  isCvcFocused: boolean;
  isCvcBlur: boolean;
  isCvcEmpty: boolean;
};
/** @deprecated Use {@link CvcStatusEvent}. */
export type cvcStatusEvent = CvcStatusEvent;

/** Structured payload delivered via the widget's `onPaymentEvent` callback. */
export type PaymentEventResult = {
  eventName: string;
  payload: string;
};
/** @deprecated Use {@link PaymentEventResult}. */
export type paymentEventResult = PaymentEventResult;

/** React Native codegen envelope wrapping {@link PaymentEventResult}. */
export type PaymentEventNative = { nativeEvent: PaymentEventResult };
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
    /** Tag of the native session; Android stamps it on the widget so it follows updateIntent. */
    sessionTag?: number;
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
