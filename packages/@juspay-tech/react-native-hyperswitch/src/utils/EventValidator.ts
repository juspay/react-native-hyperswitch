const validEventStrings = [
  'cardDetailsChange',
  'paymentMethodChange',
  'formStatusChange',
  'billingDetailsChange',
  'cvcStatusChange',
  'surchargeInfo',
  'appliedOffersInfo',
];

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
