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
  root?: StyleProp<ViewStyle>;

  container?: StyleProp<ViewStyle>;

  input?: StyleProp<TextStyle>;

  placeholder?: StyleProp<TextStyle>;

  label?: StyleProp<TextStyle>;

  error?: StyleProp<TextStyle>;

  accessory?: StyleProp<ViewStyle>;
}

/**
 * Flat theming primitives forwarded to a vault's own native/webview rendering (as opposed to
 * `FieldStyles`, which are plain React Native style objects). Currently only the `hyperswitch`
 * vault adapter honors these — other adapters ignore fields they don't support.
 */
export interface AppearanceVariables {
  colorPrimary?: string;
  colorText?: string;
  colorDanger?: string;
  colorTextPlaceholder?: string;
  colorBackground?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  fontFamily?: string;
  fontScale?: number;
  inputFieldHeight?: number;
  gap?: number;
  placeholderTextSizeAdjust?: number;
  errorTextSizeAdjust?: number;
  errorMessageSpacing?: number;
  cardBrandIcon?: BrandIconMode;
}

export interface Appearance extends FieldStyles {
  fields?: Partial<Record<ElementType, FieldStyles>>;

  variables?: AppearanceVariables;
}

export type LabelBehavior = 'above' | 'floating' | 'never';

export type ErrorDisplay = 'none' | 'colorOnly' | 'inline';

export type BrandIconMode = 'standard' | 'animated' | 'hidden' | 'hideGeneric';

export type CvcIconDisplay = 'hidden' | 'default';

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

export interface FieldOptions {
  savedCard?: SavedCard;

  label?: string;

  labelBehavior?: LabelBehavior;

  errorDisplay?: ErrorDisplay;

  unstyled?: boolean;

  accessibilityLabel?: string;

  accessibilityHint?: string;

  /** Only honored on the `cardNumber` field. */
  cardBrandIcon?: BrandIconMode;

  /** Only honored on the `cardCvc` field. */
  cvcIcon?: CvcIconDisplay;
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
