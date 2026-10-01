import type {
  PaymentEvent,
  PaymentEventWire,
} from '../types/NativeEventTypes';

/*
 * Names a merchant may subscribe to. `surchargeInfo` / `appliedOffersInfo` are
 * left out: the bundle knows them but mobile never emits them.
 */
const validEventStrings: readonly string[] = [
  'cardDetailsChange',
  'paymentMethodChange',
  'formStatusChange',
  'billingDetailsChange',
  'cvcStatusChange',
];

/*
 * Legacy event names accepted transparently so existing merchant integrations
 * keep working; everything is normalized to the bundle's current camelCase
 * taxonomy before crossing to native.
 */
const legacyToCurrentEventName: Record<string, string> = {
  PAYMENT_METHOD_INFO_CARD: 'cardDetailsChange',
  PAYMENT_METHOD_STATUS: 'paymentMethodChange',
  FORM_STATUS: 'formStatusChange',
  PAYMENT_METHOD_INFO_ADDRESS: 'billingDetailsChange',
  PAYMENT_METHOD_INFO_BILLING_ADDRESS: 'billingDetailsChange',
  CVC_STATUS: 'cvcStatusChange',
};

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

function normalizeSubscribedEvents(
  subscribedEvents: readonly string[] | undefined,
  key: string
): string[] {
  return (subscribedEvents ?? [])
    .map((event) => legacyToCurrentEventName[event] ?? event)
    .filter((event) => {
      const known = validEventStrings.includes(event);
      if (!known) warnUnknownEvent(event, key);
      return known;
    });
}

type SubscriptionOptions = {
  subscriptionEvents?: readonly string[];
  subscribedEvents?: readonly string[];
};

function mergeSubscriptionEvents(
  options: SubscriptionOptions | undefined
): string[] {
  const merged = [
    ...normalizeSubscribedEvents(options?.subscriptionEvents, 'subscriptionEvents'),
    ...normalizeSubscribedEvents(options?.subscribedEvents, 'subscribedEvents'),
  ];
  return merged.filter((event, index) => merged.indexOf(event) === index);
}

// The bundle reads `configuration.subscribedEvents`; both merchant keys collapse into it.
export function withNativeSubscription<T extends SubscriptionOptions>(
  options: T
): Omit<T, 'subscriptionEvents'> {
  const events = mergeSubscriptionEvents(options);
  const rest: SubscriptionOptions = { ...options };
  delete rest.subscriptionEvents;
  delete rest.subscribedEvents;
  return (
    events.length > 0 ? { ...rest, subscribedEvents: events } : rest
  ) as Omit<T, 'subscriptionEvents'>;
}

// RN's payment sheet cannot deliver events, so its subscriptions are dropped.
export function withoutSubscription<T extends SubscriptionOptions>(
  options: T
): Omit<T, 'subscriptionEvents' | 'subscribedEvents'> {
  const rest: SubscriptionOptions = { ...options };
  delete rest.subscriptionEvents;
  delete rest.subscribedEvents;
  return rest as Omit<T, 'subscriptionEvents' | 'subscribedEvents'>;
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
    default:
      handlers.onChange?.({
        eventName: nativeEvent.eventName,
        payload: parseEventPayload(nativeEvent.payload),
      });
  }
}

/* Every native path sends the payload as a JSON string (codegen types it so). */
export function parseEventPayload(payload: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payload);
    const isRecord =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
    return isRecord ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
