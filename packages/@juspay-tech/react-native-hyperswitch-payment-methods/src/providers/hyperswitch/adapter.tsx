import { useEffect, useMemo, useRef } from 'react';

import { fieldChange } from '../../core/fieldChange';
import type { ProviderAdapter } from '../../core/ProviderAdapter';
import { errorResult, messageOf, paymentError } from '../../core/results';
import type {
  CardDetails,
  CardEligibilityStatus,
  CardPaymentConfirmInput,
  CardPaymentMethodData,
  CardPaymentResult,
  DirectCardEligibility,
  ElementType,
  PaymentConfirmAuth,
  TokenizeErrorCode,
  TokenizeResult,
} from '../../core/types';
import type { HyperswitchDirectData, HyperswitchVaultData } from './types';

declare const require: (moduleId: string) => unknown;

type VaultSdk = any;

let vaultSdk: VaultSdk = null;
try {
  vaultSdk = require('@juspay-tech/react-native-hyperswitch-vault') as VaultSdk;
} catch {
  vaultSdk = null;
}

export const hyperswitchVaultSdkAvailable = vaultSdk != null;

const {
  CardForm: VaultCardForm,
  CardNumberField: VaultCardNumberField,
  CardExpiryField: VaultCardExpiryField,
  CardCVCField: VaultCardCVCField,
  CardholderNameField: VaultCardholderNameField,
} = vaultSdk ?? ({} as VaultSdk);

const VAULT_TYPE = 'hyperswitch' as const;

const FIELD_COMPONENT: Record<ElementType, unknown> = {
  cardNumber: VaultCardNumberField,
  cardExpiry: VaultCardExpiryField,
  cardCvc: VaultCardCVCField,
  cardholderName: VaultCardholderNameField,
};

/**
 * What the Host hands to the core once the vault form has mounted. The form
 * handle is the only thing that ever holds the card data or a minted token.
 * The mode is fixed at mount and decides, inside this adapter, which card
 * source a confirm uses; the host never names it.
 *
 * - `vault`: mounted with a payment-method session; `tokenize()` mints a
 *   token and a confirm sends the session as the card source.
 * - `direct`: mounted with NO session; nothing is tokenized and a confirm has
 *   the vault library POST `payment_method_data.card` itself.
 */
export type HyperswitchCollector =
  | { readonly mode: 'vault'; form: any; vaultData: HyperswitchVaultData }
  | { readonly mode: 'direct'; form: any; directData: HyperswitchDirectData };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateVaultData(raw: unknown): HyperswitchVaultData {
  if (
    !isRecord(raw) ||
    typeof raw.sdkAuthorization !== 'string' ||
    !raw.sdkAuthorization
  ) {
    throw new Error(
      'Hyperswitch vaultData requires a non-empty string "sdkAuthorization". Received: ' +
        JSON.stringify(raw)
    );
  }
  return raw as unknown as HyperswitchVaultData;
}

const ENVIRONMENTS = new Set(['PROD', 'SANDBOX', 'INTEG']);
const CARDHOLDER_NAME_MODES = new Set(['collect', 'external', 'omit']);

function isPaymentConfirmAuth(value: unknown): value is PaymentConfirmAuth {
  if (!isRecord(value)) return false;
  if (value.type === 'sdk_authorization') {
    return typeof value.authorization === 'string' && !!value.authorization;
  }
  if (value.type === 'publishable_key') {
    return (
      typeof value.publishableKey === 'string' &&
      !!value.publishableKey &&
      typeof value.clientSecret === 'string' &&
      !!value.clientSecret
    );
  }
  return false;
}

function validateEligibility(raw: unknown): DirectCardEligibility {
  if (
    !isRecord(raw) ||
    typeof raw.paymentId !== 'string' ||
    !raw.paymentId ||
    !isPaymentConfirmAuth(raw.auth) ||
    (raw.appId !== undefined && typeof raw.appId !== 'string') ||
    (raw.endpoint !== undefined &&
      !(isRecord(raw.endpoint) && typeof raw.endpoint.baseUrl === 'string'))
  ) {
    throw new Error(
      'Hyperswitch directCard.eligibility needs { paymentId, auth } (plus optional appId and ' +
        'endpoint.baseUrl); it never carries card data.'
    );
  }
  return raw as unknown as DirectCardEligibility;
}

/**
 * Direct mode is only entered through this validator, on the explicit
 * `directCard` configuration. It shares nothing with `validateVaultData`: a
 * vault configuration that fails validation is an error, never a direct form.
 */
function validateDirectData(raw: unknown): HyperswitchDirectData {
  if (
    !isRecord(raw) ||
    typeof raw.environment !== 'string' ||
    !ENVIRONMENTS.has(raw.environment)
  ) {
    throw new Error(
      'Hyperswitch directCard requires "environment" of "PROD", "SANDBOX" or "INTEG".'
    );
  }
  if (
    raw.enabledCardSchemes !== undefined &&
    !(
      Array.isArray(raw.enabledCardSchemes) &&
      raw.enabledCardSchemes.every(
        (scheme) => typeof scheme === 'string' && scheme.trim() !== ''
      )
    )
  ) {
    throw new Error(
      'Hyperswitch directCard.enabledCardSchemes must be an array of scheme names.'
    );
  }
  if (
    raw.cardholderName !== undefined &&
    !CARDHOLDER_NAME_MODES.has(raw.cardholderName as string)
  ) {
    throw new Error(
      'Hyperswitch directCard.cardholderName must be "collect", "external" or "omit".'
    );
  }
  return {
    environment: raw.environment as HyperswitchDirectData['environment'],
    enabledCardSchemes: (raw.enabledCardSchemes as string[] | undefined) ?? [],
    ...(raw.eligibility !== undefined
      ? { eligibility: validateEligibility(raw.eligibility) }
      : {}),
    ...(raw.cardholderName !== undefined
      ? {
          cardholderName:
            raw.cardholderName as HyperswitchDirectData['cardholderName'],
        }
      : {}),
  };
}

/** The vault library's eligibility probe config: request context only, never a card. */
function vaultEligibilityOf(eligibility: DirectCardEligibility) {
  const credential =
    eligibility.auth.type === 'sdk_authorization'
      ? { sdkAuthorization: eligibility.auth.authorization }
      : {
          publishableKey: eligibility.auth.publishableKey,
          clientSecret: eligibility.auth.clientSecret,
        };
  return {
    paymentId: eligibility.paymentId,
    ...credential,
    ...(eligibility.appId !== undefined ? { appId: eligibility.appId } : {}),
    ...(eligibility.endpoint !== undefined
      ? { endpoint: { baseUrl: eligibility.endpoint.baseUrl } }
      : {}),
  };
}

const ELIGIBILITY_STATUSES = new Set<string>([
  'unknown',
  'pending',
  'allowed',
  'denied',
]);

function cardDetailsOfVaultEvent(
  event: any,
  { withFormStatus }: { withFormStatus: boolean }
): Partial<CardDetails> {
  const payload = event?.payload ?? {};
  const details: Partial<CardDetails> = {
    bin: payload.bin ?? null,
    extendedBin: payload.extendedBin ?? null,
    last4: payload.last4 ?? null,
    brand: payload.brand ?? null,
    expiryMonth: payload.expiryMonth ?? null,
    expiryYear: payload.expiryYear ?? null,
  };
  if (withFormStatus) {
    if (typeof event?.isCoBadged === 'boolean') {
      details.isCoBadged = event.isCoBadged;
    }
    if (
      typeof event?.eligibility === 'string' &&
      ELIGIBILITY_STATUSES.has(event.eligibility)
    ) {
      details.eligibility = event.eligibility as CardEligibilityStatus;
    }
    // The vault reports an unsupported network at form level (it is not a
    // field's own error). Only the message crosses; absence clears it.
    details.networkError =
      typeof event?.networkError?.message === 'string'
        ? event.networkError.message
        : undefined;
  }
  return details;
}

const Host: ProviderAdapter['Host'] = ({
  vaultData,
  direct,
  onReady,
  onError,
  onCardDetails,
  children,
}) => {
  // Exactly one of these is set by the core; `direct` only for an explicit
  // direct-card form. The mode is recorded on the collector once, at mount.
  const directData = direct as HyperswitchDirectData | undefined;
  const data = vaultData as HyperswitchVaultData | undefined;
  const formRef = useRef<any>(null);
  // Identity-stable: the vault keys its eligibility probe on this object, so a
  // fresh one per render would re-probe the same PAN on every host re-render.
  const directEligibility = directData?.eligibility;
  const vaultEligibility = useMemo(
    () =>
      directEligibility ? vaultEligibilityOf(directEligibility) : undefined,
    [directEligibility]
  );

  useEffect(() => {
    if (!formRef.current) {
      onError(new Error('The Hyperswitch vault form did not mount.'));
      return;
    }
    if (directData) {
      const collector: HyperswitchCollector = {
        mode: 'direct',
        form: formRef.current,
        directData,
      };
      onReady(collector);
    } else if (data) {
      const collector: HyperswitchCollector = {
        mode: 'vault',
        form: formRef.current,
        vaultData: data,
      };
      onReady(collector);
    } else {
      onError(
        new Error(
          'The Hyperswitch form needs vault data or a direct-card configuration.'
        )
      );
    }
  }, [onReady, onError, data, directData]);

  if (directData) {
    // Direct card: NO vaultDetails, sdkAuthorization or session, so the vault
    // library sits in its no-session state and accepts the `direct` card
    // source. The same secure fields render; the card never leaves them.
    return (
      <VaultCardForm
        ref={formRef}
        environment={directData.environment}
        {...(directData.enabledCardSchemes.length > 0
          ? { enabledCardSchemes: directData.enabledCardSchemes }
          : {})}
        {...(vaultEligibility ? { eligibility: vaultEligibility } : {})}
        {...(directData.cardholderName !== undefined
          ? { cardholderName: directData.cardholderName }
          : {})}
        onChange={(event: any) => {
          onCardDetails?.(
            cardDetailsOfVaultEvent(event, { withFormStatus: true })
          );
        }}
      >
        {children}
      </VaultCardForm>
    );
  }

  if (!data) return <>{children}</>;

  return (
    <VaultCardForm
      ref={formRef}
      vaultDetails={{
        vaultType: 'hyperswitch',
        vaultData: { sdkAuthorization: data.sdkAuthorization },
      }}
      environment={data.environment ?? 'SANDBOX'}
      onChange={(event: any) => {
        onCardDetails?.(
          cardDetailsOfVaultEvent(event, { withFormStatus: false })
        );
      }}
    >
      {children}
    </VaultCardForm>
  );
};

const Field: ProviderAdapter['Field'] = ({
  elementType,
  styles,
  placeholder,
  testID,
  unstyled,
  cardBrandIcon,
  cvcIcon,
  savedCard,
  onChange,
  onFocus,
  onBlur,
}) => {
  const Component = FIELD_COMPONENT[elementType] as any;
  if (!Component) return null;

  // The vault field owns every accessory (brand icon, co-badge chooser, scan
  // button, CVC icon) in both its styled and unstyled forms; the host decides
  // the chrome (`unstyled`) and the icon modes.
  return (
    <Component
      styles={styles}
      placeholder={placeholder}
      testID={testID}
      {...(unstyled !== undefined ? { unstyled } : {})}
      {...(elementType === 'cardNumber' && cardBrandIcon !== undefined
        ? { cardBrandIcon }
        : {})}
      {...(elementType === 'cardCvc' && cvcIcon !== undefined
        ? { cvcIcon }
        : {})}
      options={savedCard ? { savedCard } : undefined}
      onChange={(event: any) =>
        onChange?.(
          fieldChange(elementType, {
            empty: Boolean(event?.empty),
            valid: Boolean(event?.valid),
            touched: Boolean(event?.touched),
            brand: event?.brand,
            error: event?.error,
          })
        )
      }
      onFocus={() => onFocus?.({ elementType })}
      onBlur={() => onBlur?.({ elementType })}
    />
  );
};

const SHARED_CODES = new Set<string>([
  'validation_error',
  'incomplete_field_set',
  'unsupported_configuration',
  'session_expired',
  'session_consumed',
  'invalid_session',
  'unknown_outcome',
  'tokenization_failed',
]);

const tokenize: ProviderAdapter['tokenize'] = async (
  collector
): Promise<TokenizeResult> => {
  const mounted = collector as HyperswitchCollector;
  if (mounted.mode === 'direct') {
    // No session to mint against; refused here, before the vault library and
    // without any request. The card stays in the fields.
    return errorResult(
      VAULT_TYPE,
      'unsupported_configuration',
      'This form collects a direct card and does not tokenize; call confirmCardPayment() instead.'
    );
  }
  try {
    const result = await mounted.form.tokenize();

    if (result?.status === 'success') {
      const success: TokenizeResult = {
        status: 'success',
        vaultType: VAULT_TYPE,
        data: {
          tokens: { payment_method_token: result.token },
          raw: result,
        },
      };
      return result.card ? { ...success, card: result.card } : success;
    }

    const code: TokenizeErrorCode = SHARED_CODES.has(result?.error?.code)
      ? result.error.code
      : 'tokenization_failed';
    return errorResult(
      VAULT_TYPE,
      code,
      result?.error?.message ?? 'The card could not be tokenized.'
    );
  } catch (error) {
    return errorResult(VAULT_TYPE, 'tokenization_failed', messageOf(error));
  }
};

function withoutKeys(
  data: CardPaymentMethodData | undefined,
  keys: Array<keyof CardPaymentMethodData>
): CardPaymentMethodData | undefined {
  if (!data) return undefined;
  const rest: CardPaymentMethodData = { ...data };
  for (const key of keys) delete rest[key];
  return Object.keys(rest).length > 0 ? rest : undefined;
}

// Behaviour issue recorded during the ownership migration, deliberately kept:
// the Hyperswitch-vault card path has never carried a nickname (the client had
// nowhere to put it once the card became a payment_token). Forwarding it here
// would change the mint request, so it is dropped until that is decided on its
// own. The external cardholder name is a direct-card feature and never reaches
// the tokenized path either.
const withoutNickName = (data: CardPaymentMethodData | undefined) =>
  withoutKeys(data, ['nickName', 'cardholderName']);

// The vault library takes the host's cardholder name as its own top-level
// input (and rejects the key inside payment_method_data), so it is lifted out
// here. Blank means absent: nothing is sent, never null.
function externalCardholderName(
  data: CardPaymentMethodData | undefined
): string | undefined {
  const name = data?.cardholderName;
  if (typeof name !== 'string') return undefined;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const NOT_READY_CODES = new Set<string>([
  'unsupported_configuration',
  'confirm_in_progress',
  'tokenization_in_progress',
]);

/**
 * Maps the vault library's host result onto the library-owned confirm result.
 * Anything the backend answered comes back whole as `backend_response`; only
 * outcomes with no backend body become typed local errors.
 */
export function mapVaultPaymentResult(result: unknown): CardPaymentResult {
  const r = isRecord(result) ? result : {};
  if ('response' in r && r.response !== undefined) {
    return { status: 'backend_response', response: r.response };
  }

  const error = isRecord(r.error) ? r.error : {};
  const code = typeof error.code === 'string' ? error.code : 'unknown_outcome';
  const message =
    typeof error.message === 'string' && error.message
      ? error.message
      : 'The payment could not be confirmed.';
  const type = typeof error.type === 'string' ? error.type : 'api_error';

  switch (r.status) {
    case 'validation_error':
      return paymentError('validation_error', code, message, type);

    case 'failed':
      if (code === 'unknown_outcome') {
        return paymentError('unknown_outcome', code, message, type);
      }
      if (code === 'payment_failed') {
        // A backend failure with no readable JSON body: the transport, not the
        // backend, is what the caller has to reason about.
        return paymentError('network_error', code, message, type);
      }
      if (NOT_READY_CODES.has(code)) {
        return paymentError('not_ready', code, message, type);
      }
      if (code === 'card_not_eligible' || type === 'validation_error') {
        // Refused by the library before any request — its eligibility verdict,
        // or host input it rejects (forbidden card keys, an unmountable field
        // set): a validation-class outcome the caller can correct, never a
        // tokenization failure.
        return paymentError('validation_error', code, message, type);
      }
      return paymentError('tokenization_error', code, message, type);

    case 'succeeded':
    case 'processing':
    case 'requires_customer_action':
      return paymentError(
        'network_error',
        'response_unavailable',
        'The vault library reported a backend outcome without the backend response. ' +
          'Upgrade @juspay-tech/react-native-hyperswitch-vault to a version that passes the response through.'
      );

    default:
      return paymentError('unknown_outcome', code, message, type);
  }
}

/**
 * The card source is this adapter's decision, fixed by how the form was
 * mounted. The host never names it: a `vault` form sends the payment-method
 * session it was mounted with; a `direct` form sends nothing but the marker,
 * and the vault library builds `payment_method_data.card` from the fields.
 */
function cardSourceOf(mounted: HyperswitchCollector) {
  return mounted.mode === 'direct'
    ? { type_: 'direct' as const }
    : {
        type_: 'vault' as const,
        session: {
          vault_details: {
            vault_type: 'hyperswitch',
            vault_data: {
              sdk_authorization: mounted.vaultData.sdkAuthorization,
            },
          },
        },
      };
}

const confirmPayment: NonNullable<ProviderAdapter['confirmPayment']> = async (
  collector,
  input: CardPaymentConfirmInput
): Promise<CardPaymentResult> => {
  const mounted = collector as HyperswitchCollector;
  const { form } = mounted;

  if (mounted.mode === 'vault' && !mounted.vaultData.environment) {
    return paymentError(
      'not_ready',
      'unsupported_configuration',
      'Hyperswitch vaultData.environment is required to confirm a payment; pass "PROD", "SANDBOX" or "INTEG".'
    );
  }

  const credential =
    input.auth.type === 'sdk_authorization'
      ? { sdkAuthorization: input.auth.authorization }
      : {
          publishableKey: input.auth.publishableKey,
          clientSecret: input.auth.clientSecret,
        };

  // Direct cards keep the nickname: the request is the same
  // `payment_method_data.card` the checkout's own card form sends, nickname
  // included. The tokenized path keeps dropping it (recorded behaviour).
  const paymentMethodData =
    mounted.mode === 'direct'
      ? withoutKeys(input.paymentMethodData, ['cardholderName'])
      : withoutNickName(input.paymentMethodData);

  // The host-collected holder name: honoured only by a direct form mounted with
  // `cardholderName: 'external'` (the vault library refuses it in any other
  // mode, so a misconfiguration is loud, not silently dropped).
  const cardholderName =
    mounted.mode === 'direct'
      ? externalCardholderName(input.paymentMethodData)
      : undefined;

  const vaultInput = {
    cardSource: cardSourceOf(mounted),
    paymentId: input.paymentId,
    ...credential,
    endpoint: { baseUrl: input.endpoint.baseUrl },
    ...(cardholderName !== undefined ? { cardholderName } : {}),
    ...(input.appId !== undefined ? { appId: input.appId } : {}),
    ...(input.paymentMethodType !== undefined
      ? { paymentMethodType: input.paymentMethodType }
      : {}),
    ...(paymentMethodData !== undefined ? { paymentMethodData } : {}),
    ...(input.customerAcceptance !== undefined
      ? { customerAcceptance: input.customerAcceptance }
      : {}),
    ...(input.browserInfo !== undefined
      ? { browserInfo: input.browserInfo }
      : {}),
    ...(input.returnUrl !== undefined ? { returnUrl: input.returnUrl } : {}),
    ...(input.paymentType !== undefined
      ? { paymentType: input.paymentType }
      : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    // Only a direct form can be gated on the library's eligibility verdict;
    // the tokenized request stays exactly as before.
    ...(mounted.mode === 'direct' && input.eligibilityRequired !== undefined
      ? { eligibilityRequired: input.eligibilityRequired }
      : {}),
  };

  let result: unknown;
  try {
    result = await form.confirmPayment(vaultInput);
  } catch (error) {
    return paymentError('unknown_outcome', 'unknown_outcome', messageOf(error));
  }
  return mapVaultPaymentResult(result);
};

export const hyperswitchVaultAdapter: ProviderAdapter = {
  vaultType: VAULT_TYPE,
  validateVaultData,
  validateDirectData,
  Host,
  Field,
  tokenize,
  confirmPayment,
};
