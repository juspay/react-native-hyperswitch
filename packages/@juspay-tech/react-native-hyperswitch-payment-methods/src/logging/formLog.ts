import { isRegisteredAdapter } from '../providers/registry';
import type { ProviderAdapter } from '../core/ProviderAdapter';
import type {
  ElementType,
  FieldChange,
  TokenizeResult,
  VaultType,
} from '../core/types';
import { DEFAULT_READY_TIMEOUT_MS } from '../core/formSession';
import { formatThrown, redactCardNumbers, redactDigits } from './logger';
import type { Logger } from './logger';

/* Why a card form never became usable. Web does not log this; it answers "was the card form
   shown?". */
export type FormProblem =
  | 'missing_provider_package'
  | 'no_adapter'
  | 'invalid_vault_data'
  | 'provider_failed'
  | 'detached_unsupported'
  | 'not_ready';

/* What one card form logs, in web's payment-method-session events (PaymentMethodSession.res,
   VGSVaultBroker.res). Only field names, vault types, codes and statuses: never what the customer
   typed. No method throws. */
export interface FormLog {
  created(): void;
  /* The provider has its vault details and is starting: the form should be ready within
     timeoutMs, else it is logged as never ready. */
  providerStarting(timeoutMs?: number): void;
  ready(collector: unknown, vaultType: VaultType | undefined): void;
  failed(problem: FormProblem): void;
  deinitialized(): void;
  /* mountedAt: when the field mounted, if before this call (the session's logger can arrive
     after the fields). */
  fieldMounted(elementType: ElementType, mountedAt?: number): void;
  fieldRendered(elementType: ElementType): void;
  fieldUnmounted(elementType: ElementType): void;
  fieldChanged(change: FieldChange): void;
  cleared(elementType: ElementType): void;
  crashed(elementType: ElementType, thrown: unknown): void;
  /* Logs PAYMENT_METHOD_SESSION_TOKENIZE_INIT, runs the tokenize and logs its outcome. The
     result is returned unchanged. */
  tokenize(
    vaultType: VaultType | undefined,
    adapter: ProviderAdapter | null,
    run: () => Promise<TokenizeResult>
  ): Promise<TokenizeResult>;
}

const REQUIRED_ORDER: readonly ElementType[] = [
  'cardNumber',
  'cardExpiry',
  'cardCvc',
];

/* The form logger behind each collector, so a provider can log its own flow without a change to
   the public adapter interface. */
const collectorLogs = new WeakMap<object, Logger>();

/* As web's VGSVaultBroker: the HTTP status of a VGS submit, or that it failed. Never the response
   or the error text, which can carry the vault's data. */
export function logVgsSubmit(collector: unknown, status?: number): void {
  try {
    if (typeof collector !== 'object' || collector === null) return;
    const ok = status !== undefined && status >= 200 && status < 300;
    collectorLogs.get(collector)?.log({
      eventName: 'VGS_VAULT_FLOW',
      value:
        status === undefined
          ? 'VGS submit failed'
          : `VGS submit status: ${status}`,
      logType: ok ? 'INFO' : 'ERROR',
    });
  } catch {
    /* Logging never changes what the SDK does. */
  }
}

/* The message is kept only where the SDK writes it, as web keeps it for the Hyperswitch vault
   only: other providers, a custom adapter or a caught exception can put the vault's data or the
   merchant's own text into it. */
function loggedMessage(
  result: TokenizeResult,
  vaultType: VaultType | undefined,
  adapter: ProviderAdapter | null
): string {
  if (result.status === 'success') return '';
  const { code, message } = result.error;
  const authored =
    vaultType === 'hyperswitch' &&
    code !== 'tokenization_failed' &&
    !isRegisteredAdapter(adapter);
  return authored && typeof message === 'string' ? redactDigits(message) : '';
}

/* What a crash recorded: an Error's message, type and stack, or only the kind of value thrown,
   since any other value a provider throws can carry what the customer typed. */
function recordCrash(thrown: unknown): Record<string, unknown> {
  if (thrown instanceof Error) {
    return redactCardNumbers(formatThrown(thrown)) as Record<string, unknown>;
  }
  return {
    thrown:
      thrown === null
        ? 'null'
        : Array.isArray(thrown)
          ? 'array'
          : typeof thrown,
  };
}

export function createFormLog(logger: Logger): FormLog {
  const mountedAt = new Map<ElementType, number>();
  const complete = new Map<ElementType, boolean>();
  const problems = new Set<FormProblem>();
  const crashes = new Set<string>();
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS;
  let startedAt: number | undefined;
  let isReady = false;
  let tokenizing = false;
  let dataFilledLogged = false;
  let nameFilledLogged = false;

  /* The lifecycle is logged once React's commit is over. React runs a tree's unmount cleanups
     parent first and its mount effects child first, and remounts the fields when the provider
     arrives. Settling after the commit logs the form before its fields, a field that remounts in
     the same commit once, and the fields' unmounts before the form's close, whose send then
     carries them. */
  let createdPending = false;
  const mountsPending: ElementType[] = [];
  const unmountsPending = new Set<ElementType>();
  let closing = false;
  let settleScheduled = false;
  /* Logs made in a commit that has lifecycle logs to settle, kept until they are settled. */
  const deferred: Array<() => void> = [];

  const safely = (action: () => void) => {
    try {
      action();
    } catch {
      /* Logging never changes what the SDK does. */
    }
  };

  const flow = (value: string, logType: 'INFO' | 'ERROR' = 'INFO') =>
    logger.log({
      eventName: 'CARD_FORM_FLOW',
      value,
      logType,
      ...(logType === 'ERROR' ? { category: 'USER_ERROR' as const } : {}),
    });

  const stopReadyTimer = () => {
    if (readyTimer !== undefined) clearTimeout(readyTimer);
    readyTimer = undefined;
  };

  /* As web's recordFieldComplete: once every mounted field but the cardholder name is complete,
     and once more when the name completes too. */
  const recordComplete = () => {
    const mounted = [...mountedAt.keys()];
    const required = REQUIRED_ORDER.filter((type) => mounted.includes(type));
    const isComplete = (type: ElementType) => complete.get(type) === true;
    const requiredComplete = required.length > 0 && required.every(isComplete);
    const nameComplete =
      mounted.includes('cardholderName') && isComplete('cardholderName');
    const logDataFilled = () => {
      log({
        eventName: 'PAYMENT_METHOD_SESSION_DATA_FILLED',
        value: (nameComplete ? [...required, 'cardholderName'] : required).join(
          ','
        ),
      });
      if (nameComplete) nameFilledLogged = true;
    };
    if (requiredComplete && !dataFilledLogged) {
      dataFilledLogged = true;
      logDataFilled();
    } else if (requiredComplete && nameComplete && !nameFilledLogged) {
      logDataFilled();
    }
  };

  /* The form first, then its mounted fields, then whatever else the commit logged, then the
     fields' unmounts and the form's close. */
  const settle = () => {
    if (createdPending) {
      createdPending = false;
      flow('Card form created');
    }
    for (const type of mountsPending.splice(0)) {
      logger.log({
        eventName: 'PAYMENT_METHOD_SESSION_FIELD_MOUNTED',
        value: type,
      });
    }
    for (const write of deferred.splice(0)) write();
    for (const type of unmountsPending) {
      mountedAt.delete(type);
      complete.delete(type);
      flow(`${type} unmounted`);
    }
    unmountsPending.clear();
    if (closing) {
      closing = false;
      flow('Card form deinitialized');
      logger.sendLogs();
    }
  };

  const scheduleSettle = () => {
    if (settleScheduled) return;
    settleScheduled = true;
    Promise.resolve().then(() => {
      settleScheduled = false;
      safely(settle);
    });
  };

  /* Any other log goes out as it happens, unless its commit has lifecycle logs still to settle:
     then it follows them. */
  const later = (write: () => void) => {
    if (settleScheduled) deferred.push(write);
    else write();
  };
  const log: Logger['log'] = (entry) => later(() => logger.log(entry));

  const failed = (problem: FormProblem) => {
    stopReadyTimer();
    if (problems.has(problem)) return;
    problems.add(problem);
    later(() =>
      flow(
        `Card form failed: ${
          problem === 'not_ready'
            ? `not_ready_after_${readyTimeoutMs}ms`
            : problem
        }`,
        'ERROR'
      )
    );
  };

  return {
    created() {
      safely(() => {
        /* Created again before a close settled (a development double effect): the same form. */
        if (closing) {
          closing = false;
          return;
        }
        createdPending = true;
        scheduleSettle();
      });
    },

    providerStarting(timeoutMs = DEFAULT_READY_TIMEOUT_MS) {
      safely(() => {
        if (isReady || startedAt !== undefined) return;
        startedAt = Date.now();
        readyTimeoutMs = timeoutMs;
        readyTimer = setTimeout(
          () => safely(() => failed('not_ready')),
          timeoutMs
        );
      });
    },

    ready(collector, vaultType) {
      safely(() => {
        stopReadyTimer();
        /* Ready after all, once logged as not: the timeline says when. */
        if (!isReady && problems.has('not_ready') && startedAt !== undefined) {
          log({
            eventName: 'CARD_FORM_FLOW',
            value: `Card form ready after ${Date.now() - startedAt}ms`,
          });
        }
        isReady = true;
        if (typeof collector === 'object' && collector !== null) {
          collectorLogs.set(collector, logger);
        }
        if (vaultType === 'vgs') {
          log({
            eventName: 'VGS_VAULT_FLOW',
            value: 'VGS collect form created',
          });
        }
      });
    },

    failed(problem) {
      safely(() => failed(problem));
    },

    deinitialized() {
      safely(() => {
        stopReadyTimer();
        closing = true;
        scheduleSettle();
      });
    },

    fieldMounted(elementType, since = Date.now()) {
      safely(() => {
        /* Unmounted and mounted again in one commit: one field, mounted since the first time. */
        if (unmountsPending.delete(elementType)) return;
        mountedAt.set(elementType, since);
        mountsPending.push(elementType);
        scheduleSettle();
      });
    },

    fieldRendered(elementType) {
      safely(() => {
        const since = mountedAt.get(elementType);
        log({
          eventName: 'PAYMENT_METHOD_SESSION_FIELD_RENDERED',
          value: elementType,
          ...(since === undefined ? {} : { latency: Date.now() - since }),
        });
      });
    },

    fieldUnmounted(elementType) {
      safely(() => {
        const pending = mountsPending.indexOf(elementType);
        if (pending >= 0) {
          mountsPending.splice(pending, 1);
          mountedAt.delete(elementType);
          return;
        }
        unmountsPending.add(elementType);
        scheduleSettle();
      });
    },

    fieldChanged(change) {
      safely(() => {
        if (!mountedAt.has(change.elementType)) return;
        complete.set(change.elementType, change.complete === true);
        recordComplete();
      });
    },

    cleared(elementType) {
      safely(() => log({ eventName: 'CLEAR', value: elementType }));
    },

    crashed(elementType, thrown) {
      safely(() => {
        const recorded = recordCrash(thrown);
        /* React renders a failing component more than once, each time with another stack: one
           log per session for each type and message. */
        const signature = JSON.stringify([
          logger.sessionId,
          elementType,
          recorded.type,
          recorded.message,
          recorded.thrown,
        ]);
        if (crashes.has(signature)) return;
        crashes.add(signature);
        log({
          eventName: 'SDK_CRASH',
          value: JSON.stringify({ ...recorded, componentName: elementType }),
          logType: 'ERROR',
          category: 'USER_ERROR',
        });
      });
    },

    async tokenize(vaultType, adapter, run) {
      /* A call made while one is in flight shares its result (formSession), so one attempt is
         logged once. */
      if (tokenizing) return run();
      tokenizing = true;
      try {
        return await logTokenize(vaultType, adapter, run);
      } finally {
        tokenizing = false;
      }
    },
  };

  async function logTokenize(
    vaultType: VaultType | undefined,
    adapter: ProviderAdapter | null,
    run: () => Promise<TokenizeResult>
  ): Promise<TokenizeResult> {
    safely(() =>
      log({
        eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE_INIT',
        value: vaultType ?? '',
      })
    );
    const tokenizeStartedAt = Date.now();
    const result = await run();
    safely(() => {
      const latency = Date.now() - tokenizeStartedAt;
      const type = result.vaultType ?? vaultType ?? '';
      log(
        result.status === 'success'
          ? {
              eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE',
              value: JSON.stringify({ vaultType: type }),
              latency,
            }
          : {
              eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE',
              value: JSON.stringify({
                vaultType: type,
                code: result.error.code,
                message: loggedMessage(result, vaultType, adapter),
              }),
              logType: 'ERROR',
              category: 'USER_ERROR',
              latency,
            }
      );
    });
    return result;
  }
}
