import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import {
  MessageElement,
  type MessageContent,
  type MessageElementStyle,
  type PaymentMethodMessage,
} from '../messages/MessageContent';

/* A tap names its message: `paymentMethodType` is empty when the shown text is the payment
   method's own message, `index` is the segment's position in that message's `value`, and
   `text` is what it showed. A segment with other text is not the one tapped. */
export type MessageAction = {
  paymentMethod: string;
  paymentMethodType: string;
  index: number;
  text: string;
};

/* The segments as sent: empty text is dropped, so positions match the bridge `value`. */
const segmentsOf = (content: MessageContent) =>
  content.filter((part) => part !== '');

export function dispatchMessageAction(
  configuration: PaymentSheetConfiguration | undefined,
  { paymentMethod, paymentMethodType, index, text }: MessageAction
) {
  const config = configuration?.paymentMethodsConfig?.find(
    (entry) => entry.paymentMethod === paymentMethod
  );
  const message =
    paymentMethodType === ''
      ? config?.message
      : config?.paymentMethodTypes?.find(
          (entry) => entry.paymentMethodType === paymentMethodType
        )?.message;
  if (!Array.isArray(message?.value)) return;
  const segment = segmentsOf(message.value)[index];
  if (segment instanceof MessageElement && segment.options.label === text) {
    segment.options.onClick();
  }
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
   Native routes each tap to its own widget or sheet. */
export function preparePaymentMessages(
  configuration?: PaymentSheetConfiguration
): {
  configuration: Record<string, unknown> | undefined;
  hasActions: boolean;
} {
  let hasActions = false;
  if (!Array.isArray(configuration?.paymentMethodsConfig)) {
    return {
      configuration: configuration as Record<string, unknown> | undefined,
      hasActions,
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
    const { value: content } = message;
    if (content == null) return base;
    if (typeof content === 'string') {
      return { ...base, value: [{ text: content }] };
    }
    if (
      !Array.isArray(content) ||
      content.some(
        (part) => typeof part !== 'string' && !(part instanceof MessageElement)
      )
    ) {
      throw new TypeError(
        'A message value is text, or messageContent / an array of text and MessageElement actions.'
      );
    }
    const value = segmentsOf(content).map((part) => {
      if (typeof part === 'string') return { text: part };
      const { label, style } = part.options;
      hasActions = true;
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
  return { configuration: wire, hasActions };
}
