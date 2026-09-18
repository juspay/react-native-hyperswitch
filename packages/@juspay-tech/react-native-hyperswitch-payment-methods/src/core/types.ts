import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type FormId = string;

export type VaultType =
  'hyperswitch' | 'vgs' | 'skyflow' | 'basis_theory' | 'evervault';

export type ElementType =
  'cardNumber' | 'cardExpiry' | 'cardCvc' | 'cardholderName';

export interface VaultDetails {
  vaultType: VaultType;

  vaultData: unknown;
}

export interface FieldStyles {
  container?: StyleProp<ViewStyle>;

  input?: StyleProp<TextStyle>;
}

/**
 * The web SDK's `appearance.variables` names that the Hyperswitch vault fields
 * honour. Length values accept a number (RN points) or a CSS `px` string as on
 * web; other CSS units are dropped.
 */
export interface AppearanceVariables {
  colorPrimary?: string;
  colorText?: string;
  colorDanger?: string;
  colorTextPlaceholder?: string;
  colorBackground?: string;
  borderColor?: string;
  borderRadius?: number | string;
  fontFamily?: string;
  inputFieldHeight?: number | string;
}

/**
 * The web SDK's theme presets. Accepted so a web `appearance` object can be
 * passed unchanged; the Hyperswitch vault has no presets, so every value
 * renders the default look on RN.
 */
export type AppearanceTheme =
  | 'default'
  | 'midnight'
  | 'brutal'
  | 'charcoal'
  | 'soft'
  | 'bubblegum'
  | 'none';

/** The web SDK's `appearance.labels` values (`none` renders no label). */
export type AppearanceLabels = 'above' | 'floating' | 'none';

export interface Appearance extends FieldStyles {
  fields?: Partial<Record<ElementType, FieldStyles>>;

  theme?: AppearanceTheme;

  variables?: AppearanceVariables;

  labels?: AppearanceLabels;
}

/**
 * The web SDK's per-field `options.appearance`. On RN its `variables` become
 * that field's styles over the session theme, and `labels` that field's
 * label behaviour.
 */
export type FieldAppearance = Pick<
  Appearance,
  'theme' | 'variables' | 'labels'
>;

export interface SavedCardData {
  cardNetwork?: string;
}

export interface SavedCardPaymentMethodData {
  card?: SavedCardData;
}

export interface SavedCard {
  paymentMethodToken?: string;

  paymentMethodData?: SavedCardPaymentMethodData;
}

export type CvcIconDisplay = 'hidden' | 'default';

export type CardBrandIconDisplay =
  'standard' | 'hidden' | 'animated' | 'hideGeneric';

/** The web SDK's per-field `options` object, same names and nesting. */
export interface FieldOptions {
  placeholder?: string;

  /** `CardCVCField` only. */
  cvcIcon?: CvcIconDisplay;

  /** `CardNumberField` only. */
  cardBrandIcon?: CardBrandIconDisplay;

  /**
   * `CardForm.onChange` emits `cardDetailsChange` only while a mounted field
   * subscribes to it, as on web.
   */
  subscriptionEvents?: readonly string[];

  /** Per-field appearance, see {@link FieldAppearance}. */
  appearance?: FieldAppearance;

  savedCard?: SavedCard;
}

export interface FieldEvent {
  elementType: ElementType;
}

export interface FieldChange {
  elementType: ElementType;
  empty: boolean;
  complete: boolean;
  valid: boolean;
  brand?: string;
  error?: string;
  touched: boolean;
}

export interface CardDetails {
  bin: string | null;
  extendedBin: string | null;
  last4: string | null;
  brand: string | null;
  expiryMonth: string | null;
  expiryYear: string | null;
  formattedExpiry: string | null;
  isCardNumberComplete: boolean;
  isCvcComplete: boolean;
  isExpiryComplete: boolean;
  isCardNumberValid: boolean;
  isExpiryValid: boolean;
}

export interface CardFormEvent {
  elementType: 'cardForm';
}

export interface CardFormChange {
  elementType: 'cardForm';
  eventName: 'cardDetailsChange';
  payload: CardDetails;

  complete: boolean;

  valid: boolean;

  fields: Partial<Record<ElementType, FieldChange>>;
}

export type TokenizeStatus = 'success' | 'validation_error' | 'error';

export type TokenizeErrorType = 'validation_error' | 'api_error' | 'card_error';

export type TokenizeErrorCode =
  | 'validation_error'
  | 'incomplete_field_set'
  | 'sdk_not_ready'
  | 'unsupported_configuration'
  | 'session_expired'
  | 'session_consumed'
  | 'invalid_session'
  | 'unknown_outcome'
  | 'tokenization_failed';

export interface TokenizeError {
  code: TokenizeErrorCode;
  message: string;
  type: TokenizeErrorType;
}

export interface TokenizedCard {
  bin?: string;
  last4?: string;
  brand?: string;
  expiryMonth?: string;
  expiryYear?: string;
}

export interface TokenizeData {
  tokens?: Record<string, unknown>;

  raw?: unknown;

  savedCard?: SavedCard;
}

export type TokenizeResult =
  | {
      status: 'success';
      vaultType?: VaultType;
      data?: TokenizeData;
      card?: TokenizedCard;
    }
  | {
      status: 'validation_error' | 'error';
      vaultType?: VaultType;
      error: TokenizeError;
    };

export type FormStatus = 'initializing' | 'ready' | 'tokenizing' | 'error';

export interface CardFormInstance {
  tokenize(providerData?: unknown): Promise<TokenizeResult>;
  readonly status: FormStatus;
}

export interface CardFormHandle {
  tokenize(providerData?: unknown): Promise<TokenizeResult>;
  readonly status: FormStatus;
}

export interface FieldHandle {
  focus(): void;
  blur(): void;
  clear(): void;
}
