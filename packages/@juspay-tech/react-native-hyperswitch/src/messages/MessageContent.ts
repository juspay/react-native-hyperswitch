export interface MessageElementStyle {
  readonly color?: string;
  readonly fontSize?: number;
  readonly fontWeight?:
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900';
  readonly fontStyle?: 'normal' | 'italic';
  readonly textDecoration?: 'none' | 'underline';
}

/** Defaults for every action in the message; an action's own style overrides them per property. */
export interface MessageElementStyles {
  readonly action?: MessageElementStyle;
}

export interface MessageActionOptions {
  readonly label: string;
  readonly style?: MessageElementStyle;
  readonly onClick: () => void;
}

export interface PaymentMethodMessage {
  readonly displayMode?: 'custom_message' | 'default_sdk_message' | 'hidden';
  readonly value?: string | MessageContent;
  readonly elementStyles?: MessageElementStyles;
}

export class MessageElement {
  private constructor(
    /** @internal */ readonly options: MessageActionOptions
  ) {}

  static action(options: MessageActionOptions): MessageElement {
    if (
      typeof options.label !== 'string' ||
      typeof options.onClick !== 'function'
    ) {
      throw new TypeError(
        'MessageElement.action requires a label and onClick callback.'
      );
    }
    return new MessageElement({ ...options });
  }
}

/** Message text and actions, in display order. Build it with `messageContent` or as an array. */
export type MessageContent = readonly (string | MessageElement)[];

/** A tagged template retains the actual elements; no string parser is needed in RN. */
export function messageContent(
  strings: TemplateStringsArray,
  ...values: readonly (MessageElement | string | number)[]
): MessageContent {
  const parts: (string | MessageElement)[] = [strings[0] ?? ''];
  values.forEach((part, index) => {
    if (part instanceof MessageElement) {
      parts.push(part);
    } else if (typeof part === 'string' || typeof part === 'number') {
      parts.push(String(part));
    } else {
      throw new TypeError('Use MessageElement factories in messageContent.');
    }
    parts.push(strings[index + 1] ?? '');
  });
  return parts;
}
