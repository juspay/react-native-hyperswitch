import type { MountedFields } from './savedCard';

export const CARD_DETAILS_CHANGE = 'cardDetailsChange';

/** The event names the web SDK accepts in `options.subscriptionEvents`. */
export const KNOWN_SUBSCRIPTION_EVENTS: readonly string[] = [
  'paymentMethodChange',
  CARD_DETAILS_CHANGE,
  'formStatusChange',
  'cvcStatusChange',
  'billingDetailsChange',
  'surchargeInfo',
  'appliedOffersInfo',
];

/**
 * PENDING DECISION. The web SDK emits `cardDetailsChange` on the form only
 * after a field subscribed to it; 1.0.x emitted it unconditionally. Until the
 * breaking default is agreed, keep emitting for forms with no subscriber (and
 * warn once in development). Flipping this to `false` gives the web default.
 */
export const EMIT_WITHOUT_SUBSCRIPTION = true;

export function subscribesTo(mounted: MountedFields, event: string): boolean {
  return Object.values(mounted).some((field) =>
    field?.subscriptionEvents?.includes(event)
  );
}

export function warnUnsubscribedEmission(): void {
  if (!__DEV__) return;
  console.warn(
    `[CardForm] onChange fired without any field subscribing through options.subscriptionEvents: ['${CARD_DETAILS_CHANGE}']. The web SDK emits only after that opt-in; React Native still emits without it. Adding the opt-in keeps the integration portable if a future major release adopts the web default.`
  );
}

export function warnUnknownSubscriptionEvents(
  events: readonly string[] | undefined
): void {
  if (!events || !__DEV__) return;
  for (const event of events) {
    if (!KNOWN_SUBSCRIPTION_EVENTS.includes(event)) {
      console.warn(
        `[CardForm] Unknown subscriptionEvents entry "${event}"; the card form emits "${CARD_DETAILS_CHANGE}".`
      );
    }
  }
}
