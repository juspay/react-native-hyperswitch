import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import {
  MessageContent,
  type MessageElementStyle,
  type PaymentMethodMessage,
} from '../messages/MessageContent';

export const MESSAGE_EVENT = 'customMessageElementClicked';

/* In the order the actions are written, which is the order the tap `index` counts in. */
export type MessageCallback = () => void;

function parsePayload(payload: unknown): Record<string, unknown> | undefined {
  try {
    const value: unknown =
      typeof payload === 'string' ? JSON.parse(payload) : payload;
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Consumes every internal event, even stale or malformed ones, so none reaches public onChange. */
export function dispatchMessageAction(
  callbacks: readonly MessageCallback[],
  event: { eventName: string; payload: unknown }
): boolean {
  if (event.eventName !== MESSAGE_EVENT) return false;
  const data = parsePayload(event.payload);
  if (typeof data?.index === 'number') callbacks[data.index]?.();
  return true;
}

/* Copies only the supported keys. The bundle validates values, but a non-finite fontSize
   must not reach native JSON serialization, so it is dropped here. */
function styleToWire(style: MessageElementStyle | undefined) {
  if (!style) return undefined;
  const { color, fontSize, fontWeight, fontStyle, textDecoration } = style;
  const validFontSize =
    typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize >= 0;
  const wire = {
    color,
    fontSize: validFontSize ? fontSize : undefined,
    fontWeight,
    fontStyle,
    textDecoration,
  };
  const entries = Object.entries(wire).filter(
    ([, value]) => value !== undefined
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/* Converts rich messages to the bridge JSON: text and tappable segments, no placeholders.
   Native routes each event to its own widget or sheet. */
export function preparePaymentMessages(
  configuration?: PaymentSheetConfiguration
): {
  configuration: Record<string, unknown> | undefined;
  callbacks: MessageCallback[];
} {
  const callbacks: MessageCallback[] = [];
  if (!Array.isArray(configuration?.paymentMethodsConfig)) {
    return {
      configuration: configuration as Record<string, unknown> | undefined,
      callbacks,
    };
  }

  function convert(message: PaymentMethodMessage) {
    const actionDefaults = styleToWire(message.elementStyles?.action);
    const base = {
      ...(message.displayMode !== undefined
        ? { displayMode: message.displayMode }
        : {}),
      ...(actionDefaults ? { elementStyles: { action: actionDefaults } } : {}),
    };
    if (!(message.value instanceof MessageContent)) {
      if (message.value != null && typeof message.value !== 'string') {
        throw new TypeError(
          'Use the messageContent tagged template for rich message values.'
        );
      }
      return message.value === undefined
        ? base
        : { ...base, value: [{ text: message.value }] };
    }
    const value = message.value.parts
      .filter((part) => part !== '')
      .map((part) => {
        if (typeof part === 'string') return { text: part };
        const { label, style, onClick } = part.options;
        callbacks.push(onClick);
        const wireStyle = styleToWire(style);
        return {
          text: label,
          tappable: true,
          ...(wireStyle ? { style: wireStyle } : {}),
        };
      });
    return { ...base, value };
  }

  function withWireMessage<T extends { message?: unknown } | null>(entry: T) {
    return entry?.message != null && typeof entry.message === 'object'
      ? { ...entry, message: convert(entry.message as PaymentMethodMessage) }
      : entry;
  }

  /* Each payment method's message, then its types' messages: the order client-core counts in. */
  const wire: Record<string, unknown> = {
    ...configuration,
    paymentMethodsConfig: configuration.paymentMethodsConfig.map((config) => {
      const entry = withWireMessage(config);
      return Array.isArray(config?.paymentMethodTypes)
        ? {
            ...entry,
            paymentMethodTypes: config.paymentMethodTypes.map(withWireMessage),
          }
        : entry;
    }),
  };
  if (callbacks.length) {
    wire.subscribedEvents = [
      ...(configuration.subscribedEvents ?? []),
      MESSAGE_EVENT,
    ];
  }
  return { configuration: wire, callbacks };
}
