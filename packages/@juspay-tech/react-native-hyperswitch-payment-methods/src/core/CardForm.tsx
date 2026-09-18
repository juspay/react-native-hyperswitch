import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { FormContext } from './FormContext';
import type { FormContextValue } from './FormContext';
import { createFormSession } from './formSession';
import type { CreateFormSessionOptions } from './formSession';
import { registerForm } from './formRegistry';
import { resolveAdapter } from '../providers/registry';
import { SessionContext } from '../session/SessionContext';
import type { ProviderAdapter } from './ProviderAdapter';
import {
  errorResult,
  paymentError,
  paymentErrorOfTokenizeProblem,
  tokenizedCardOf,
} from './results';
import {
  checkConfiguration,
  mountedField,
  savedCardOf,
  withSavedCard,
} from './savedCard';
import type { MountedFields, UnresolvedVault } from './savedCard';
import type {
  Appearance,
  CardDetails,
  CardFormChange,
  CardFormEvent,
  CardFormHandle,
  CardPaymentConfirmInput,
  CardPaymentResult,
  DirectCardConfig,
  ElementType,
  FieldChange,
  FieldOptions,
  FormId,
  FormStatus,
  TokenizeResult,
  VaultDetails,
  VaultType,
} from './types';

/** The only provider whose fields can confirm a direct card themselves. */
const DIRECT_CARD_VAULT_TYPE: VaultType = 'hyperswitch';

function unavailableAdapter(vaultType: VaultType): ProviderAdapter {
  return {
    vaultType,
    validateVaultData: (raw) => raw,
    Host: () => null,
    Field: () => null,
    tokenize: async () =>
      errorResult(
        vaultType,
        'tokenization_failed',
        `No provider is available for vault type "${vaultType}".`
      ),
  };
}

export interface CardFormProps {
  /** Tokenized mode: the provider vault this form mints a token with. */
  vaultDetails?: VaultDetails;

  /**
   * Explicit direct-card mode: no vault, no payment-method session, no
   * tokenization. The provider's own fields hold the card and
   * `confirmCardPayment` has the provider POST `/payments/{id}/confirm`
   * itself. Mutually exclusive with `vaultDetails` (prop or session); a form
   * without either is a configuration error, never a direct form.
   */
  directCard?: DirectCardConfig;

  appearance?: Appearance;

  id?: FormId;

  onReady?: (event: CardFormEvent) => void;

  onChange?: (event: CardFormChange) => void;

  onError?: (error: unknown) => void;

  readyTimeoutMs?: number;
  children?: ReactNode;
}

type ValidatedData =
  | { ok: true; vaultData: unknown; direct?: undefined }
  | { ok: true; vaultData?: undefined; direct: unknown }
  | { ok: false; error: unknown };

const twoDigit = (value: string) => (value.length === 1 ? `0${value}` : value);

function buildChange(
  fields: Partial<Record<ElementType, FieldChange>>,
  details: Partial<CardDetails>
): CardFormChange {
  const number = fields.cardNumber;
  const expiry = fields.cardExpiry;
  const cvc = fields.cardCvc;
  const mounted = Object.values(fields).filter(
    (field): field is FieldChange => field !== undefined
  );
  const expiryMonth = details.expiryMonth ?? null;
  const expiryYear = details.expiryYear ?? null;
  const formattedExpiry =
    details.formattedExpiry ??
    (expiryMonth && expiryYear
      ? `${twoDigit(expiryMonth)} / ${expiryYear.slice(-2)}`
      : null);
  return {
    elementType: 'cardForm',
    eventName: 'cardDetailsChange',
    payload: {
      bin: details.bin ?? null,
      extendedBin: details.extendedBin ?? null,
      last4: details.last4 ?? null,
      brand: details.brand ?? number?.brand ?? null,
      expiryMonth,
      expiryYear,
      formattedExpiry,
      isCardNumberComplete: number?.complete ?? false,
      isCvcComplete: cvc?.complete ?? false,
      isExpiryComplete: expiry?.complete ?? false,
      isCardNumberValid: number?.valid ?? false,
      isExpiryValid: expiry?.valid ?? false,
      ...(details.isCoBadged !== undefined
        ? { isCoBadged: details.isCoBadged }
        : {}),
      ...(details.eligibility !== undefined
        ? { eligibility: details.eligibility }
        : {}),
      ...(details.networkError !== undefined
        ? { networkError: details.networkError }
        : {}),
    },
    complete: mounted.length > 0 && mounted.every((field) => field.complete),
    valid:
      mounted.length > 0 &&
      mounted.every((field) => field.valid) &&
      details.networkError === undefined,
    fields: { ...fields },
  };
}

export const CardForm = forwardRef<CardFormHandle, CardFormProps>(
  function CardFormImpl(
    {
      vaultDetails,
      directCard,
      appearance,
      id,
      onReady,
      onChange,
      onError,
      readyTimeoutMs,
      children,
    },
    ref
  ) {
    const session = useContext(SessionContext);

    const details = vaultDetails ?? session?.vaultDetails;
    // Direct mode is only ever explicit: the prop names it, and the provider
    // is fixed. A missing vault configuration stays a configuration error.
    const vaultType = directCard ? DIRECT_CARD_VAULT_TYPE : details?.vaultType;

    const { adapter, resolveError } = useMemo(() => {
      if (!vaultType) {
        return { adapter: null, resolveError: undefined as unknown };
      }
      try {
        return {
          adapter: resolveAdapter(vaultType),
          resolveError: undefined as unknown,
        };
      } catch (error) {
        return {
          adapter: unavailableAdapter(vaultType),
          resolveError: error as unknown,
        };
      }
    }, [vaultType]);

    const validated = useMemo<ValidatedData>(() => {
      if (resolveError !== undefined) return { ok: false, error: resolveError };
      if (directCard) {
        if (details) {
          return {
            ok: false,
            error: new Error(
              'directCard cannot be combined with vaultDetails: a form is either a direct ' +
                'card form or a tokenized vault form.'
            ),
          };
        }
        if (!adapter?.validateDirectData) {
          return {
            ok: false,
            error: new Error(
              `The ${vaultType} provider cannot collect a direct card.`
            ),
          };
        }
        try {
          return { ok: true, direct: adapter.validateDirectData(directCard) };
        } catch (error) {
          return { ok: false, error };
        }
      }
      if (!adapter || !details) return { ok: false, error: undefined };
      try {
        return {
          ok: true,
          vaultData: adapter.validateVaultData(details.vaultData),
        };
      } catch (error) {
        return { ok: false, error };
      }
    }, [adapter, details, directCard, resolveError, vaultType]);

    const sessionOptions = useMemo<CreateFormSessionOptions>(
      () => (readyTimeoutMs !== undefined ? { readyTimeoutMs } : {}),
      [readyTimeoutMs]
    );

    const formSession = useMemo(
      () => createFormSession(adapter, sessionOptions),
      [adapter, sessionOptions]
    );

    const [collector, setCollector] = useState<unknown>(undefined);
    const [status, setStatus] = useState<FormStatus>('initializing');

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    const fieldsRef = useRef<Partial<Record<ElementType, FieldChange>>>({});
    const mountedRef = useRef<MountedFields>({});
    const detailsRef = useRef<Partial<CardDetails>>({});

    const unresolvedRef = useRef<UnresolvedVault>({ pending: false });
    unresolvedRef.current = {
      pending: session?.loading ?? false,
      reason: session?.error
        ? `Could not resolve the vault configuration: ${session.error.message}`
        : undefined,
    };

    const emitChange = useCallback(() => {
      const listener = onChangeRef.current;
      if (listener)
        listener(buildChange(fieldsRef.current, detailsRef.current));
    }, []);

    const reportChange = useCallback(
      (change: FieldChange) => {
        fieldsRef.current[change.elementType] = change;
        emitChange();
      },
      [emitChange]
    );

    const registerField = useCallback(
      (elementType: ElementType, options?: FieldOptions) => {
        mountedRef.current[elementType] = mountedField(elementType, options);
      },
      []
    );

    const forgetField = useCallback((elementType: ElementType) => {
      delete fieldsRef.current[elementType];
      delete mountedRef.current[elementType];
    }, []);

    const handleCardDetails = useCallback(
      (next: Partial<CardDetails>) => {
        detailsRef.current = { ...detailsRef.current, ...next };
        emitChange();
      },
      [emitChange]
    );

    const handleReady = useCallback(
      (next: unknown) => {
        formSession.attachCollector(next);
        setCollector(next);
        setStatus('ready');
        onReadyRef.current?.({ elementType: 'cardForm' });
      },
      [formSession]
    );

    const handleError = useCallback(
      (error: unknown) => {
        formSession.fail(error);
        setStatus('error');
        onError?.(error);
      },
      [formSession, onError]
    );

    const tokenize = useCallback(
      async (providerData?: unknown): Promise<TokenizeResult> => {
        const mounted = mountedRef.current;

        const problem = checkConfiguration(
          vaultType,
          mounted,
          unresolvedRef.current
        );
        if (problem) return problem;

        const result = await formSession.tokenize(providerData);
        setStatus(formSession.status);
        if (result.status !== 'success') return result;

        const card = tokenizedCardOf(detailsRef.current);
        return withSavedCard(
          card ? { ...result, card } : result,
          savedCardOf(mounted)
        );
      },
      [formSession, vaultType]
    );

    const confirmPayment = useCallback(
      async (input: CardPaymentConfirmInput): Promise<CardPaymentResult> => {
        const mounted = mountedRef.current;

        const problem = checkConfiguration(
          vaultType,
          mounted,
          unresolvedRef.current
        );
        if (problem) return paymentErrorOfTokenizeProblem(problem);

        if (savedCardOf(mounted)) {
          return paymentError(
            'validation_error',
            'unsupported_configuration',
            'confirmPayment collects a whole card; a CVC-only saved-card form cannot confirm a payment.'
          );
        }

        return formSession.confirmPayment(input);
      },
      [formSession, vaultType]
    );

    useImperativeHandle(
      ref,
      () => ({
        tokenize,
        confirmPayment,
        get status() {
          return status;
        },
      }),
      [tokenize, confirmPayment, status]
    );

    useEffect(() => {
      if (!id) return;
      return registerForm(id, { tokenize, confirmPayment });
    }, [id, tokenize, confirmPayment]);

    useEffect(() => {
      if (!validated.ok && validated.error !== undefined) {
        handleError(validated.error);
      }
    }, [validated, handleError]);

    const appearances = useMemo<readonly Appearance[]>(() => {
      const layers: Appearance[] = [];
      if (session?.appearance) layers.push(session.appearance);
      if (appearance) layers.push(appearance);
      return layers;
    }, [session?.appearance, appearance]);

    const value = useMemo<FormContextValue>(
      () => ({
        vaultType,
        adapter,
        collector,
        status,
        appearances,
        tokenize,
        confirmPayment,
        reportChange,
        registerField,
        forgetField,
      }),
      [
        vaultType,
        adapter,
        collector,
        status,
        appearances,
        tokenize,
        confirmPayment,
        reportChange,
        registerField,
        forgetField,
      ]
    );

    const Host = adapter?.Host;

    return (
      <FormContext.Provider value={value}>
        {validated.ok && Host ? (
          <Host
            vaultData={validated.vaultData}
            direct={validated.direct}
            onReady={handleReady}
            onError={handleError}
            onCardDetails={handleCardDetails}
          >
            {children}
          </Host>
        ) : (
          children
        )}
      </FormContext.Provider>
    );
  }
);
