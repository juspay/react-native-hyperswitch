import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import {
  MessageContent,
  type MessageElement,
  type MessageElementStyle,
  type PaymentMethodMessage,
} from '../messages/MessageContent';

export const MESSAGE_EVENT = 'customMessageElementClicked';

export type MessageCallback = { key: string; onClick: () => void };

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
  if (data && typeof data.key === 'string' && data.type === 'action') {
    callbacks.find(({ key }) => key === data.key)?.onClick();
  }
  return true;
}

/* Copies only the supported keys. The bundle validates values, but a non-finite fontSize
   must not reach native JSON serialization, so it is dropped here. */
function styleToWire(style: MessageElementStyle | undefined) {
  if (!style) return undefined;
  const { color, fontSize, fontWeight, fontStyle, textDecoration } = style;
  const validFontSize =
    typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize >= 0;
  if (fontSize !== undefined && !validFontSize) {
    console.warn(
      '[Hyperswitch] Message fontSize must be finite and nonnegative; ignoring it.'
    );
  }
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

/* A random suffix keeps keys unguessable, as native's UUID keys are, so interpolated
   text cannot reference an action. */
export const randomKeySuffix = () => Math.random().toString(36).slice(2, 10);

/* Converts rich messages to the bridge JSON. Keys only need to be unique within one
   surface: native routes each event to its own widget or sheet. */
export function preparePaymentMessages(
  configuration?: PaymentSheetConfiguration,
  keySuffix: string = randomKeySuffix()
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

  function convert(message: PaymentMethodMessage, messageIndex: number) {
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
        : { ...base, value: message.value };
    }
    const elements: MessageElement[] = [];
    const actions: Record<string, unknown>[] = [];
    let value = '';
    message.value.parts.forEach((part) => {
      if (typeof part === 'string') {
        value += part;
        return;
      }
      const existing = elements.indexOf(part);
      const key = `m${messageIndex}_a${
        existing === -1 ? elements.length : existing
      }_${keySuffix}`;
      value += `{{${key}}}`;
      if (existing !== -1) return;
      elements.push(part);
      const { label, style, onClick } = part.options;
      const wireStyle = styleToWire(style);
      actions.push({ key, label, ...(wireStyle ? { style: wireStyle } : {}) });
      callbacks.push({ key, onClick });
    });
    return {
      ...base,
      value,
      ...(actions.length ? { elements: { action: actions } } : {}),
    };
  }

  let messageIndex = 0;
  function withWireMessage<T extends { message?: unknown } | null>(entry: T) {
    return entry?.message != null && typeof entry.message === 'object'
      ? {
          ...entry,
          message: convert(
            entry.message as PaymentMethodMessage,
            messageIndex++
          ),
        }
      : entry;
  }

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
