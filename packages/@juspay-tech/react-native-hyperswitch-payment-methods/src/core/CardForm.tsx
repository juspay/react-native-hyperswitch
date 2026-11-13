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
import { isMissingSdkError, resolveAdapter } from '../providers/registry';
import { SessionContext } from '../session/SessionContext';
import { createFormLog } from '../logging/formLog';
import type { FormProblem } from '../logging/formLog';
import { LoggerContext } from '../logging/LoggerContext';
import type { ProviderAdapter } from './ProviderAdapter';
import { errorResult, tokenizedCardOf } from './results';
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
  ElementType,
  FieldChange,
  FieldOptions,
  FormId,
  FormStatus,
  TokenizeResult,
  VaultDetails,
  VaultType,
} from './types';

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
  vaultDetails?: VaultDetails;

  appearance?: Appearance;

  unstyled?: boolean;

  id?: FormId;

  onReady?: (event: CardFormEvent) => void;

  onChange?: (event: CardFormChange) => void;

  onError?: (error: unknown) => void;

  readyTimeoutMs?: number;
  children?: ReactNode;
}

type ValidatedData =
  { ok: true; value: unknown } | { ok: false; error: unknown };

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
    },
    complete: mounted.length > 0 && mounted.every((field) => field.complete),
    valid: mounted.length > 0 && mounted.every((field) => field.valid),
    fields: { ...fields },
  };
}

export const CardForm = forwardRef<CardFormHandle, CardFormProps>(
  function CardFormImpl(
    {
      vaultDetails,
      appearance,
      unstyled,
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
    const logger = useContext(LoggerContext);

    const details = vaultDetails ?? session?.vaultDetails;
    const vaultType = details?.vaultType;
    const vaultTypeRef = useRef(vaultType);
    vaultTypeRef.current = vaultType;

    /* The form's logs, inside a session only. Read through a ref, so the callbacks the provider
       and the app hold keep their identity. */
    const readyTimeoutRef = useRef(readyTimeoutMs);
    readyTimeoutRef.current = readyTimeoutMs;
    const formLog = useMemo(
      () => (logger ? createFormLog(logger) : undefined),
      [logger]
    );
    const formLogRef = useRef(formLog);
    formLogRef.current = formLog;
    useEffect(() => {
      if (!formLog) return;
      formLog.created();
      return () => formLog.deinitialized();
    }, [formLog]);
    /* Why the form failed, logged once the session's logger is there: it can arrive after the
       provider has already answered. */
    const problemRef = useRef<FormProblem | undefined>(undefined);

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
      if (!adapter || !details) return { ok: false, error: undefined };
      try {
        return {
          ok: true,
          value: adapter.validateVaultData(details.vaultData),
        };
      } catch (error) {
        return { ok: false, error };
      }
    }, [adapter, details, resolveError]);

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

    // const aliveRef = useRef(true);
    // useEffect(() => {
    //   aliveRef.current = true;
    //   return () => {
    //     aliveRef.current = false;
    //   };
    // }, []);
    // const flushScheduledRef = useRef(false);
    // const lastEmittedRef = useRef('');
    // const sessionKey = details ? JSON.stringify(details) : '';
    // useEffect(() => {
    //   lastEmittedRef.current = '';
    // }, [sessionKey]);
    // const flushChange = useCallback(() => {
    //   flushScheduledRef.current = false;
    //   if (!aliveRef.current) return;
    //   const listener = onChangeRef.current;
    //   if (!listener) return;
    //   const change = buildChange(fieldsRef.current, detailsRef.current);
    //   const serialized = JSON.stringify(change);
    //   if (serialized === lastEmittedRef.current) return;
    //   lastEmittedRef.current = serialized;
    //   try {
    //     listener(change);
    //   } catch (error) {
    //     setTimeout(() => {
    //   throw error;
    //     }, 0);
    //   }
    // }, []);
    // const emitChange = useCallback(() => {
    //   if (flushScheduledRef.current) return;
    //   flushScheduledRef.current = true;
    //   Promise.resolve().then(flushChange);
    // }, [flushChange]);

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

    const handleHostError = useCallback(
      (error: unknown) => {
        problemRef.current = 'provider_failed';
        handleError(error);
      },
      [handleError]
    );

    const tokenize = useCallback(
      async (providerData?: unknown): Promise<TokenizeResult> => {
        const run = async (): Promise<TokenizeResult> => {
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
        };
        const log = formLogRef.current;
        return log ? log.tokenize(vaultType, adapter, run) : run();
      },
      [formSession, vaultType, adapter]
    );

    useImperativeHandle(
      ref,
      () => ({
        tokenize,
        get status() {
          return status;
        },
      }),
      [tokenize, status]
    );

    useEffect(() => {
      if (!id) return;
      return registerForm(id, tokenize);
    }, [id, tokenize]);

    useEffect(() => {
      if (!validated.ok && validated.error !== undefined) {
        problemRef.current =
          validated.error !== resolveError
            ? 'invalid_vault_data'
            : isMissingSdkError(resolveError)
              ? 'missing_provider_package'
              : 'no_adapter';
        handleError(validated.error);
      }
    }, [validated, handleError, resolveError]);

    /* The provider starts once the vault details are known, so a slow session lookup is not
       counted against the form's readiness. */
    const providerStarting = validated.ok && adapter !== null;
    useEffect(() => {
      if (formLog && providerStarting) {
        formLog.providerStarting(readyTimeoutRef.current);
      }
    }, [formLog, providerStarting]);

    useEffect(() => {
      if (!formLog) return;
      if (status === 'error') {
        formLog.failed(problemRef.current ?? 'provider_failed');
      } else if (collector !== undefined) {
        formLog.ready(collector, vaultTypeRef.current);
      }
    }, [formLog, status, collector]);

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
        unstyled,
        tokenize,
        reportChange,
        registerField,
        forgetField,
        log: formLog,
      }),
      [
        vaultType,
        adapter,
        collector,
        status,
        appearances,
        unstyled,
        tokenize,
        reportChange,
        registerField,
        forgetField,
        formLog,
      ]
    );

    const Host = adapter?.Host;

    return (
      <FormContext.Provider value={value}>
        {validated.ok && Host ? (
          <Host
            vaultData={validated.value}
            onReady={handleReady}
            onError={handleHostError}
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
