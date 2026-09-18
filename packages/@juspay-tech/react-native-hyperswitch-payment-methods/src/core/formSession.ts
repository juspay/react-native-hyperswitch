import { createDeferred } from './deferred';
import type { ProviderAdapter } from './ProviderAdapter';
import { errorResult, messageOf, paymentError } from './results';
import type {
  CardPaymentConfirmInput,
  CardPaymentResult,
  FormStatus,
  TokenizeResult,
} from './types';

const DEFAULT_READY_TIMEOUT_MS = 10_000;

export interface CreateFormSessionOptions {
  readyTimeoutMs?: number;
}

export interface FormSession {
  readonly status: FormStatus;

  attachCollector(collector: unknown): void;

  fail(error: unknown): void;
  tokenize(providerData?: unknown): Promise<TokenizeResult>;
  confirmPayment(input: CardPaymentConfirmInput): Promise<CardPaymentResult>;
}

// One operation per form at a time. A repeated call of the same kind shares the
// pending promise (duplicate-submit protection); a call of the other kind is
// refused so tokenize and confirm can never interleave on one collector.
type Operation =
  | { kind: 'tokenize'; promise: Promise<TokenizeResult> }
  | { kind: 'confirm'; promise: Promise<CardPaymentResult> };

type Readiness =
  | { ok: true; collector: unknown }
  | {
      ok: false;
      code: 'unsupported_configuration' | 'form_unavailable' | 'sdk_not_ready';
      message: string;
    };

export function createFormSession(
  adapter: ProviderAdapter | null,
  options: CreateFormSessionOptions = {}
): FormSession {
  const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  const ready = createDeferred<void>();
  const vaultType = adapter?.vaultType;

  let collector: unknown | undefined;
  let failure: { error: unknown } | undefined;
  let status: FormStatus = 'initializing';
  let inFlight: Operation | undefined;

  async function waitForReady(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, readyTimeoutMs);
    });
    try {
      await Promise.race([ready.promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Synchronous when the answer is already known, so the status transition of
  // an immediately-runnable operation happens in the same tick as the call.
  function currentReadiness(): Readiness {
    if (!adapter) {
      return {
        ok: false,
        code: 'unsupported_configuration',
        message:
          'No vault configuration. Pass options.vaultDetails or options.sdkAuthorization on ' +
          '<HyperPaymentMethodSession>, or vaultDetails directly on <CardForm>.',
      };
    }

    if (failure) {
      return {
        ok: false,
        code: 'form_unavailable',
        message: messageOf(failure.error),
      };
    }

    if (collector === undefined) {
      return {
        ok: false,
        code: 'sdk_not_ready',
        message: `The ${vaultType} card fields are not ready yet. Try again once the form has finished initializing.`,
      };
    }

    return { ok: true, collector };
  }

  function mustWait(): boolean {
    return adapter !== null && collector === undefined && !failure;
  }

  function runTokenize(providerData?: unknown): Promise<TokenizeResult> {
    if (mustWait()) {
      return waitForReady().then(() => tokenizeNow(providerData));
    }
    return tokenizeNow(providerData);
  }

  async function tokenizeNow(providerData?: unknown): Promise<TokenizeResult> {
    const state = currentReadiness();
    if (!state.ok) {
      // Preserve the historical tokenize codes exactly.
      const code =
        state.code === 'form_unavailable' ? 'tokenization_failed' : state.code;
      return errorResult(
        state.code === 'unsupported_configuration' ? undefined : vaultType,
        code,
        state.message
      );
    }

    status = 'tokenizing';
    try {
      const result = await adapter!.tokenize(state.collector, providerData);
      status = 'ready';
      return result;
    } catch (error) {
      status = 'ready';
      return errorResult(vaultType, 'tokenization_failed', messageOf(error));
    }
  }

  function runConfirm(
    input: CardPaymentConfirmInput
  ): Promise<CardPaymentResult> {
    if (mustWait()) {
      return waitForReady().then(() => confirmNow(input));
    }
    return confirmNow(input);
  }

  async function confirmNow(
    input: CardPaymentConfirmInput
  ): Promise<CardPaymentResult> {
    const state = currentReadiness();
    if (!state.ok) {
      return paymentError('not_ready', state.code, state.message);
    }

    const confirm = adapter!.confirmPayment;
    if (!confirm) {
      return paymentError(
        'not_ready',
        'unsupported_configuration',
        `The ${vaultType} provider does not support library-owned payment confirmation.`
      );
    }

    try {
      return await confirm.call(adapter, state.collector, input);
    } catch (error) {
      // The adapter threw somewhere between building and reading the request;
      // whether the backend saw it is unknowable here.
      return paymentError(
        'unknown_outcome',
        'unknown_outcome',
        messageOf(error)
      );
    }
  }

  function track<T>(kind: Operation['kind'], pending: Promise<T>): Promise<T> {
    const tracked = pending.finally(() => {
      if (inFlight && inFlight.promise === tracked) inFlight = undefined;
    });
    inFlight = { kind, promise: tracked } as Operation;
    return tracked;
  }

  return {
    get status() {
      return status;
    },

    attachCollector(next: unknown) {
      if (failure) return;
      collector = next;
      status = 'ready';
      ready.resolve();
    },

    fail(error: unknown) {
      failure = { error };
      status = 'error';
      ready.resolve();
    },

    tokenize(providerData?: unknown): Promise<TokenizeResult> {
      if (inFlight?.kind === 'tokenize') return inFlight.promise;
      if (inFlight?.kind === 'confirm') {
        return Promise.resolve(
          errorResult(
            vaultType,
            'tokenization_failed',
            'A payment confirmation is already in progress for this form.'
          )
        );
      }
      return track('tokenize', runTokenize(providerData));
    },

    confirmPayment(input: CardPaymentConfirmInput): Promise<CardPaymentResult> {
      if (inFlight?.kind === 'confirm') return inFlight.promise;
      if (inFlight?.kind === 'tokenize') {
        return Promise.resolve(
          paymentError(
            'not_ready',
            'tokenization_in_progress',
            'A tokenization is already in progress for this form.'
          )
        );
      }
      return track('confirm', runConfirm(input));
    },
  };
}
