import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { fieldChange } from '../../core/fieldChange';
import type { ProviderAdapter } from '../../core/ProviderAdapter';
import { errorResult, messageOf } from '../../core/results';
import type {
  CardDetails,
  ElementType,
  TokenizeErrorCode,
  TokenizeResult,
} from '../../core/types';
import { Placeholder } from '../../fields/Placeholder';
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

/*
 * `CardForm.res` rebuilds its `contextValue` fresh on every render (unmemoized), so its
 * `onContext` effect refires on every re-render regardless of whether anything meaningful
 * changed. Since publishing that value calls `core.notify()`, which re-renders this activator's
 * own parent, an unmemoized activator would re-render → refire the effect → notify → re-render,
 * forever. Memoizing it means it only ever re-renders when its own props genuinely change
 * (vaultDetails/environment are memoized below, onContext is a stable ref-backed callback), so
 * once mounted it renders exactly once more per real change instead of looping.
 */
const MemoizedVaultCardForm: any = VaultCardForm ? memo(VaultCardForm) : undefined;

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

/*
 * Hyperswitch's own vault SDK coordinates its native fields through a React context
 * (`VaultWidgetContext`) rather than a plain client object, so — unlike VGS/Skyflow/BasisTheory/
 * Evervault — there's no collector you can build before any field mounts. Something has to stay
 * mounted for the session's lifetime to hold that context value.
 *
 * `createCollector` resolves immediately to this pending session; `contextValue`/`handle` fill in
 * once the "anchor" field (see `Field` below) has actually mounted and run the session hook.
 */
interface HyperswitchSession {
  vaultData: HyperswitchVaultData;
  contextValue?: unknown;
  handle?: { tokenize(): Promise<unknown> };
}

const createCollector = async (
  vaultData: unknown
): Promise<HyperswitchSession> => ({
  vaultData: vaultData as HyperswitchVaultData,
  contextValue: undefined,
});

const Host: ProviderAdapter['Host'] = ({
  vaultData,
  onReady,
  onError,
  onCardDetails,
  children,
}) => {
  const data = vaultData as HyperswitchVaultData;
  const formRef = useRef<any>(null);

  useEffect(() => {
    if (formRef.current) onReady(formRef.current);
    else onError(new Error('The Hyperswitch vault form did not mount.'));
  }, [onReady, onError]);

  return (
    <VaultCardForm
      ref={formRef}
      vaultDetails={{
        vaultType: 'hyperswitch',
        vaultData: { sdkAuthorization: data.sdkAuthorization },
      }}
      environment={data.environment ?? 'SANDBOX'}
      onChange={(event: any) => {
        const payload = event?.payload ?? {};
        const details: Partial<CardDetails> = {
          bin: payload.bin ?? null,
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
  collector,
  styles,
  placeholder,
  testID,
  savedCard,
  onChange,
  onFocus,
  onBlur,
  onCollectorReady,
}) => {
  const Component = FIELD_COMPONENT[elementType] as any;
  if (!Component) return null;

  const session = collector as HyperswitchSession | undefined;
  const sdkAuthorization = session?.vaultData.sdkAuthorization;
  const environment = session?.vaultData.environment;
  const formRef = useRef<any>(null);

  // Read by the (identity-stable) handleContext below, so its own identity never depends on
  // `session` — see the note on MemoizedVaultCardForm for why that matters.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const onCollectorReadyRef = useRef(onCollectorReady);
  onCollectorReadyRef.current = onCollectorReady;

  const vaultDetails = useMemo(
    () =>
      sdkAuthorization
        ? { vaultType: 'hyperswitch' as const, vaultData: { sdkAuthorization } }
        : undefined,
    [sdkAuthorization]
  );

  const handleContext = useCallback((contextValue: unknown) => {
    const current = sessionRef.current;
    if (!current) return;
    onCollectorReadyRef.current?.({
      ...current,
      contextValue,
      handle: formRef.current ?? current.handle,
    });
  }, []);

  /*
   * `cardNumber` doubles as this form's anchor: it's the field that stays mounted and quietly
   * carries the shared session for every other field on the same `form`, invisibly (renders no
   * children of its own — nothing to see). Don't unmount CardNumberField while the form is in
   * use — its session, and whatever the user has typed, goes with it.
   */
  const activator =
    elementType === 'cardNumber' && vaultDetails && MemoizedVaultCardForm ? (
      <MemoizedVaultCardForm
        ref={formRef}
        vaultDetails={vaultDetails}
        environment={environment ?? 'SANDBOX'}
        onContext={handleContext}
      />
    ) : null;

  if (!session || session.contextValue === undefined) {
    return (
      <>
        {activator}
        <Placeholder elementType={elementType} styles={styles} testID={testID} />
      </>
    );
  }

  return (
    <>
      {activator}
      <Component
        form={session.contextValue}
        styles={styles}
        placeholder={placeholder}
        testID={testID}
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
    </>
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
  /*
   * Two shapes reach here: context mode's collector IS the form's imperative handle
   * (`{tokenize, confirmPayment, reset, focus}`, from `Host`'s onReady). Headless mode's
   * collector is the `HyperswitchSession` wrapper — the handle lives at `.handle` and is only
   * set once the anchor field has actually mounted.
   */
  const handle =
    collector && typeof (collector as any).tokenize === 'function'
      ? collector
      : (collector as HyperswitchSession | undefined)?.handle;

  if (!handle) {
    return errorResult(
      VAULT_TYPE,
      'sdk_not_ready',
      'The hyperswitch card fields are not ready yet. Make sure CardNumberField is mounted.'
    );
  }

  try {
    const result = await (handle as any).tokenize();

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
  createCollector,
  Host,
  Field,
  tokenize,
};
