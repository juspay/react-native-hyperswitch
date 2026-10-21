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

/** Payloads delivered to merchants by the current subscription events. */
export type CardDetailsChange = {
  readonly bin: string | null;
  readonly extendedBin: string | null;
  readonly last4: string | null;
  readonly brand: string | null;
  readonly expiryMonth: string | null;
  readonly expiryYear: string | null;
  readonly formattedExpiry: string | null;
  readonly isCardNumberComplete: boolean;
  readonly isCardNumberValid: boolean;
  readonly isExpiryComplete: boolean;
  readonly isExpiryValid: boolean;
  readonly isCvcComplete: boolean;
};

export type PaymentMethodChange = {
  readonly paymentMethod: string;
  readonly paymentMethodType: string;
  readonly isSavedPaymentMethod: boolean;
  readonly isOneClickWallet: boolean;
};

export type FormStatusValue = 'EMPTY' | 'FILLING' | 'COMPLETE';
export type FormStatusChange = { readonly status: FormStatusValue };

export type BillingDetailsChange = {
  readonly country: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
};

export type CvcStatusChange = {
  readonly cvcStatus: {
    readonly isCvcEmpty: boolean;
    readonly isCvcComplete: boolean;
  };
};

/** Adding a name here requires its payload to be defined as well. */
export type PaymentEventPayloads = {
  cardDetailsChange: CardDetailsChange;
  paymentMethodChange: PaymentMethodChange;
  formStatusChange: FormStatusChange;
  billingDetailsChange: BillingDetailsChange;
  cvcStatusChange: CvcStatusChange;
};

/** Check eventName to narrow payload without a cast. */
export type PaymentEvent<Name extends keyof PaymentEventPayloads = keyof PaymentEventPayloads> = {
  [Key in Name]: {
    readonly eventName: Key;
    readonly payload: PaymentEventPayloads[Key];
  };
}[Name];

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
