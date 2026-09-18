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

// ---------------------------------------------------------------------------
// Explicit direct-card mode.
//
// A direct form renders the provider's own secure fields WITHOUT a
// payment-method session: nothing is tokenized, the raw card never leaves the
// provider, and `confirmCardPayment` has the provider POST
// `/payments/{id}/confirm` itself with `payment_method_data.card`. It is only
// ever entered through `CardForm`'s `directCard` prop; a missing or invalid
// `vaultDetails` is a configuration error, never direct mode.
// ---------------------------------------------------------------------------

export type DirectCardEnvironment = 'PROD' | 'SANDBOX' | 'INTEG';

/**
 * Where a direct card's holder name comes from (the vault library's own modes):
 * - `collect` (default): a mounted `CardholderNameField` collects it;
 * - `external`: the host supplies it on the confirm input as
 *   `paymentMethodData.cardholderName`; no name field is rendered or required;
 * - `omit`: no holder name is sent.
 */
export type DirectCardholderNameMode = 'collect' | 'external' | 'omit';

/**
 * Lets the provider probe `/payments/{id}/eligibility` for the card it holds
 * as soon as the number is complete. Only the request context crosses this
 * boundary; the PAN stays inside the provider. The verdict is reported as
 * `CardDetails.eligibility` and enforced by `confirmCardPayment` when the
 * input carries `eligibilityRequired: true`.
 */
export interface DirectCardEligibility {
  paymentId: string;
  auth: PaymentConfirmAuth;
  appId?: string;
  /** The payment backend base. Defaults to the environment's public base. */
  endpoint?: PaymentEndpoint;
}

export interface DirectCardConfig {
  /** Payment backend environment; also picks the provider's asset host. */
  environment: DirectCardEnvironment;
  /**
   * Schemes the merchant accepts. Drives the provider's co-badged network
   * chooser and its unsupported-network validation. Empty or absent: every
   * detected scheme is accepted and no choice is offered.
   */
  enabledCardSchemes?: string[];
  eligibility?: DirectCardEligibility;
  cardholderName?: DirectCardholderNameMode;
}

export interface FieldStyles {
  container?: StyleProp<ViewStyle>;

  input?: StyleProp<TextStyle>;
}

export interface Appearance extends FieldStyles {
  fields?: Partial<Record<ElementType, FieldStyles>>;
}

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

export interface FieldOptions {
  savedCard?: SavedCard;
}

/**
 * Who draws the card-number brand accessory. Mirrors the checkout's
 * `cardBrandIcon` layout setting: `standard` shows a generic card glyph until a
 * network is detected, `animated` cycles network logos while empty, `hidden`
 * draws none, `hideGeneric` draws only a detected network.
 */
export type CardBrandIconMode =
  'standard' | 'animated' | 'hidden' | 'hideGeneric';

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

/** Outcome of the provider's own eligibility probe, when the form runs one. */
export type CardEligibilityStatus =
  'unknown' | 'pending' | 'allowed' | 'denied';

export interface CardDetails {
  bin: string | null;
  extendedBin: string | null;
  last4: string | null;
  /** The network in force: detected, or the one picked on a co-badged card. */
  brand: string | null;
  expiryMonth: string | null;
  expiryYear: string | null;
  formattedExpiry: string | null;
  isCardNumberComplete: boolean;
  isCvcComplete: boolean;
  isExpiryComplete: boolean;
  isCardNumberValid: boolean;
  isExpiryValid: boolean;
  /** True while the number matches more than one enabled scheme and a choice is offered. */
  isCoBadged?: boolean;
  /** Present only for forms that run an eligibility probe (see `DirectCardConfig.eligibility`). */
  eligibility?: CardEligibilityStatus;
  /**
   * The provider's own message when the network in force is outside
   * `enabledCardSchemes`. Reported once the provider decides to show it (after
   * a network choice or a submit attempt); while present the form is not valid.
   */
  networkError?: string;
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
  confirmPayment(input: CardPaymentConfirmInput): Promise<CardPaymentResult>;
  readonly status: FormStatus;
}

export interface CardFormHandle {
  tokenize(providerData?: unknown): Promise<TokenizeResult>;
  confirmPayment(input: CardPaymentConfirmInput): Promise<CardPaymentResult>;
  readonly status: FormStatus;
}

export interface FieldHandle {
  focus(): void;
  blur(): void;
  clear(): void;
}

// ---------------------------------------------------------------------------
// Library-owned card payment confirmation (`POST /payments/{id}/confirm`).
//
// The host supplies already-computed non-card context and the payment-intent
// credential. The library owns the card representation, merges it with that
// context, performs the request, and hands back the complete backend body.
// ---------------------------------------------------------------------------

/**
 * Credential for the payment-intent confirm call. This is distinct from the
 * vault `sdkAuthorization` carried in `VaultDetails.vaultData`, which only
 * authorizes the payment-method session used for tokenization.
 *
 * - `sdk_authorization` → `Authorization` header, no `client_secret` in the body.
 * - `publishable_key`   → `api-key` header, `client_secret` in the body.
 */
export type PaymentConfirmAuth =
  | { type: 'sdk_authorization'; authorization: string }
  | { type: 'publishable_key'; publishableKey: string; clientSecret: string };

/** The resolved payment backend base. The request goes to `${baseUrl}/payments/{id}/confirm`. */
export interface PaymentEndpoint {
  baseUrl: string;
}

export type CardPaymentMethodType = 'credit' | 'debit';

export type CardPaymentType =
  'normal' | 'new_mandate' | 'setup_mandate' | 'recurring_mandate';

export interface CardPaymentBillingAddress {
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  line3?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
}

export interface CardPaymentPhone {
  number?: string;
  countryCode?: string;
}

export interface CardPaymentBilling {
  address?: CardPaymentBillingAddress;
  email?: string;
  phone?: CardPaymentPhone;
}

/**
 * Non-card `payment_method_data`. Card keys (number, expiry, CVC) are never
 * accepted here. `nickName` and `cardholderName` are the two host-owned
 * values that ride under `payment_method_data.card` — as `nick_name` and
 * `card_holder_name`, always as separate keys.
 */
export interface CardPaymentMethodData {
  billing?: CardPaymentBilling;
  nickName?: string;
  /**
   * Direct forms mounted with `cardholderName: 'external'` only: the name the
   * host collected outside the library's fields. Blank or absent is omitted
   * from the request, never sent as null. Ignored by tokenized forms.
   */
  cardholderName?: string;
}

export interface CardPaymentOnlineAcceptance {
  userAgent?: string;
}

export interface CardPaymentCustomerAcceptance {
  acceptanceType: 'online' | 'offline';
  acceptedAt: string;
  online: CardPaymentOnlineAcceptance;
}

export interface CardPaymentBrowserInfo {
  userAgent?: string;
  acceptHeader?: string;
  language?: string;
  colorDepth?: number;
  screenHeight?: number;
  screenWidth?: number;
  timeZone?: number;
  javaEnabled?: boolean;
  javaScriptEnabled?: boolean;
  deviceModel?: string;
  osType?: string;
  osVersion?: string;
}

/**
 * Everything the host contributes to a card confirm. Whether each optional
 * field is present is the host's decision; the library forwards presence
 * exactly and never invents a value.
 */
export interface CardPaymentConfirmInput {
  paymentId: string;
  auth: PaymentConfirmAuth;
  endpoint: PaymentEndpoint;
  appId?: string;
  paymentMethodType?: CardPaymentMethodType;
  paymentMethodData?: CardPaymentMethodData;
  customerAcceptance?: CardPaymentCustomerAcceptance;
  browserInfo?: CardPaymentBrowserInfo;
  returnUrl?: string;
  paymentType?: CardPaymentType;
  email?: string;
  /**
   * Direct cards only: gate the confirm on the provider's eligibility verdict
   * for the card it holds (`/payments/{id}/eligibility`, PAN never leaves the
   * provider). A denied card answers `validation_error` / `card_not_eligible`
   * and no confirm request is sent. Ignored by tokenized forms.
   */
  eligibilityRequired?: boolean;
}

export type CardPaymentErrorStatus =
  | 'validation_error'
  | 'not_ready'
  | 'tokenization_error'
  | 'network_error'
  | 'unknown_outcome';

export interface CardPaymentError {
  code: string;
  message: string;
  type: string;
}

/**
 * `backend_response` carries the complete parsed JSON body the backend
 * returned, for 2xx and non-2xx alike; the host decodes it. Every other status
 * is a local outcome: the backend produced no readable body.
 */
export type CardPaymentResult =
  | { status: 'backend_response'; response: unknown }
  | { status: CardPaymentErrorStatus; error: CardPaymentError };
