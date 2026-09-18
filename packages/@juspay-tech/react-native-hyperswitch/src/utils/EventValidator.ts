const validEventStrings = [
  'cardDetailsChange',
  'paymentMethodChange',
  'formStatusChange',
  'billingDetailsChange',
  'cvcStatusChange',
  'surchargeInfo',
  'appliedOffersInfo',
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

/*
 * Maps legacy SCREAMING_SNAKE subscriptions onto current event names; unknown
 * strings pass through untouched so `validateSubscribedEventStrings` can flag
 * them for the merchant.
 */
export function normalizeSubscribedEvents(
  subscribedEvents: string[] | undefined
): string[] {
  if (!subscribedEvents) {
    return [];
  }
  return subscribedEvents.map(
    (event) => legacyToCurrentEventName[event] ?? event
  );
}

export function getValidEventsString(): string {
  return validEventStrings.join(', ');
}

export function validateSubscribedEventStrings(
  subscribedEvents: string[] | undefined
): string[] {
  if (!subscribedEvents) {
    return [];
  }
  return subscribedEvents.filter((event) => !validEventStrings.includes(event));
}

export type UnknownEventWarningPayload = {
  message: string;
  invalidEvents: string[];
  validEvents: string[];
};

export function makeUnknownEventWarningPayload(
  invalidEvents: string[]
): UnknownEventWarningPayload {
  const invalidEventsStr = invalidEvents.join(', ');
  const validEventsStr = getValidEventsString();
  return {
    message: `Unknown event(s) subscribed: [${invalidEventsStr}]. Valid events are: ${validEventsStr}`,
    invalidEvents,
    validEvents: validEventStrings,
  };
}
