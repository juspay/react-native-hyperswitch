import type {
  PaymentEvent,
  CardDetailsChange,
  BillingDetailsChange,
  PaymentEventWire,
} from '../types/NativeEventTypes';
import type { SubscriptionEvent } from '../types/PaymentSheetConfiguration';

/*
 * Names a merchant may subscribe to. `surchargeInfo` / `appliedOffersInfo` are
 * left out: the bundle knows them but mobile never emits them.
 */
const validEventStrings: readonly SubscriptionEvent[] = [
  'cardDetailsChange',
  'paymentMethodChange',
  'formStatusChange',
  'billingDetailsChange',
  'cvcStatusChange',
];

function isSubscriptionEvent(name: string): name is SubscriptionEvent {
  return validEventStrings.some((event) => event === name);
}

const warnedUnknownEvents = new Set<string>();

// Options are re-read on every render, so each unknown name warns only once.
function warnUnknownEvent(event: string, key: string): void {
  if (warnedUnknownEvents.has(event)) return;
  warnedUnknownEvents.add(event);
  const expected = validEventStrings.map((name) => `'${name}'`).join(', ');
  console.warn(
    `Unknown Value: '${event}' value in options.${key}, Expected ${expected}`
  );
}

type SubscriptionOptions = {
  subscriptionEvents?: readonly string[];
};

// Validate names while keeping the same configuration key through the native bridge.
export function withSubscriptionEvents<T extends SubscriptionOptions>(options: T): T {
  if (!options.subscriptionEvents) return options;
  return {
    ...options,
    subscriptionEvents: options.subscriptionEvents.filter((event) => {
      const known = isSubscriptionEvent(event);
      if (!known) warnUnknownEvent(event, 'subscriptionEvents');
      return known;
    }),
  };
}

// RN's payment sheet cannot deliver events, so its subscriptions are dropped.
export function withoutSubscription<T extends SubscriptionOptions>(
  options: T
): Omit<T, 'subscriptionEvents'> {
  const rest = { ...options };
  delete rest.subscriptionEvents;
  return rest;
}

export type WidgetEventHandlers = {
  onChange?: (event: PaymentEvent) => void;
  onReady?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

// Lifecycle events (`ready`, `focus`, `blur`) need no subscription and never reach `onChange`.
export function routeWidgetEvent(
  nativeEvent: PaymentEventWire,
  handlers: WidgetEventHandlers
): void {
  switch (nativeEvent.eventName) {
    case 'ready':
      handlers.onReady?.();
      return;
    case 'focus':
      handlers.onFocus?.();
      return;
    case 'blur':
      handlers.onBlur?.();
      return;
    default: {
      const event = decodePaymentEvent(nativeEvent.eventName, parseEventPayload(nativeEvent.payload));
      if (event) handlers.onChange?.(event);
    }
  }
}

/* Every native path sends the payload as a JSON string (codegen types it so). */
export function parseEventPayload(payload: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payload);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isCardDetailsChange(value: Record<string, unknown>): value is CardDetailsChange {
  const textFields = [
    'bin', 'extendedBin', 'last4', 'brand', 'expiryMonth', 'expiryYear', 'formattedExpiry',
  ] as const satisfies readonly (keyof CardDetailsChange)[];
  const flags = [
    'isCardNumberComplete', 'isCardNumberValid', 'isExpiryComplete', 'isExpiryValid', 'isCvcComplete',
  ] as const satisfies readonly (keyof CardDetailsChange)[];
  return textFields.every((key) => isNullableString(value[key])) &&
    flags.every((key) => typeof value[key] === 'boolean');
}

function isBillingDetailsChange(value: Record<string, unknown>): value is BillingDetailsChange {
  return isNullableString(value.country) &&
    isNullableString(value.state) && isNullableString(value.postalCode);
}

/** Decode the bridge contract before exposing a typed event to merchant code. */
function decodePaymentEvent(eventName: string, payload: unknown): PaymentEvent | null {
  if (!isRecord(payload)) return null;
  switch (eventName) {
    case 'cardDetailsChange':
      return isCardDetailsChange(payload) ? { eventName, payload } : null;
    case 'paymentMethodChange':
      if (typeof payload.paymentMethod !== 'string' ||
          typeof payload.paymentMethodType !== 'string' ||
          typeof payload.isSavedPaymentMethod !== 'boolean' ||
          typeof payload.isOneClickWallet !== 'boolean') return null;
      return { eventName, payload: {
        paymentMethod: payload.paymentMethod,
        paymentMethodType: payload.paymentMethodType,
        isSavedPaymentMethod: payload.isSavedPaymentMethod,
        isOneClickWallet: payload.isOneClickWallet,
      } };
    case 'formStatusChange':
      if (payload.status !== 'EMPTY' && payload.status !== 'FILLING' && payload.status !== 'COMPLETE') return null;
      return { eventName, payload: { status: payload.status } };
    case 'billingDetailsChange':
      return isBillingDetailsChange(payload) ? { eventName, payload } : null;
    case 'cvcStatusChange': {
      const status = payload.cvcStatus;
      if (!isRecord(status) || typeof status.isCvcEmpty !== 'boolean' ||
          typeof status.isCvcComplete !== 'boolean') return null;
      return { eventName, payload: { cvcStatus: {
        isCvcEmpty: status.isCvcEmpty,
        isCvcComplete: status.isCvcComplete,
      } } };
    }
    default:
      return null;
  }
}
