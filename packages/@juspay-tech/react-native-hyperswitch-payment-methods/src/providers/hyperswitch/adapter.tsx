import { useContext, useEffect, useMemo, useRef } from 'react';

import { fieldChange } from '../../core/fieldChange';
import { FormContext } from '../../core/FormContext';
import type { ProviderAdapter } from '../../core/ProviderAdapter';
import { errorResult, messageOf } from '../../core/results';
import type {
  CardDetails,
  ElementType,
  TokenizeErrorCode,
  TokenizeResult,
} from '../../core/types';
import { SessionContext } from '../../session/SessionContext';
import { VaultSessionContext } from '../../session/VaultSessionContext';
import { toVaultAppearance } from './appearance';
import type { HyperswitchVaultData } from './types';

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

const Host: ProviderAdapter['Host'] = ({
  vaultData,
  onReady,
  onError,
  onCardDetails,
  children,
}) => {
  const data = vaultData as HyperswitchVaultData;
  const formRef = useRef<any>(null);

  // Configuration that the merchant gave the session (not the vault
  // credentials) is read from context so the public `HyperswitchVaultData`
  // stays the web's `{sdkAuthorization}`.
  const session = useContext(SessionContext);
  const expiry = useContext(VaultSessionContext);
  const form = useContext(FormContext);

  const hyper = session?.hyper;
  // An explicit vaultData.environment wins; then the instance the session was
  // created with (its lookup used the same value, default PROD); a bare
  // <CardForm> outside a session keeps its previous SANDBOX default.
  const environment =
    data.environment ?? hyper?.environment ?? (session ? 'PROD' : 'SANDBOX');
  const customEndpoints = hyper?.customEndpoints;
  const locale = session?.locale ?? undefined;
  const layers = form?.appearances;
  const appearance = useMemo(
    () => (layers ? toVaultAppearance(layers) : undefined),
    [layers]
  );
  // The vault reads `expires_at` only from its `session` prop, so a looked-up
  // expiry is handed over in that shape. It applies only to the authorization
  // it was fetched for: a <CardForm vaultDetails> override never inherits it.
  const expiresAt =
    expiry && expiry.sdkAuthorization === data.sdkAuthorization
      ? expiry.expiresAt
      : undefined;
  const vaultSession = useMemo(
    () =>
      expiresAt
        ? {
            vault_details: {
              vault_type: 'hyperswitch',
              vault_data: { sdk_authorization: data.sdkAuthorization },
            },
            expires_at: expiresAt,
          }
        : undefined,
    [expiresAt, data.sdkAuthorization]
  );

  useEffect(() => {
    if (formRef.current) onReady(formRef.current);
    else onError(new Error('The Hyperswitch vault form did not mount.'));
  }, [onReady, onError]);

  return (
    <VaultCardForm
      ref={formRef}
      {...(vaultSession
        ? { session: vaultSession }
        : {
            vaultDetails: {
              vaultType: 'hyperswitch',
              vaultData: { sdkAuthorization: data.sdkAuthorization },
            },
          })}
      environment={environment}
      customEndpoints={customEndpoints}
      locale={locale}
      appearance={appearance}
      onChange={(event: any) => {
        const payload = event?.payload ?? {};
        const details: Partial<CardDetails> = {
          bin: payload.bin ?? null,
          extendedBin: payload.extendedBin ?? null,
          last4: payload.last4 ?? null,
          brand: payload.brand ?? null,
          expiryMonth: payload.expiryMonth ?? null,
          expiryYear: payload.expiryYear ?? null,
        };
        onCardDetails?.(details);
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
  savedCard,
  cvcIcon,
  cardBrandIcon,
  onChange,
  onFocus,
  onBlur,
}) => {
  const Component = FIELD_COMPONENT[elementType] as any;
  if (!Component) return null;

  return (
    <Component
      styles={styles}
      placeholder={placeholder}
      testID={testID}
      options={savedCard ? { savedCard } : undefined}
      cvcIcon={elementType === 'cardCvc' ? cvcIcon : undefined}
      cardBrandIcon={elementType === 'cardNumber' ? cardBrandIcon : undefined}
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
  try {
    const result = await (collector as any).tokenize();

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

export const hyperswitchVaultAdapter: ProviderAdapter = {
  vaultType: VAULT_TYPE,
  validateVaultData,
  Host,
  Field,
  tokenize,
};
