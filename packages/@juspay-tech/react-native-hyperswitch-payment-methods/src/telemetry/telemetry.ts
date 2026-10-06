/* The shared logger, copied in by scripts/sync-logger.mjs; it is never published on its own.
   Its types stay out of this file's exports, so the published declarations never point into
   the copy. */
import {
  createLogger,
  generateSessionId,
  safeErrorResponse,
} from './vendor/hyperswitch-logger';
import type {
  customEndpoints,
  eventName,
  logType,
} from './vendor/hyperswitch-logger';

import { environmentOf } from '../session/config';
import type { HyperswitchConfiguration } from '../session/config';
import { parseAuthorizationClaims } from '../session/sdkAuthorization';
import type {
  ElementType,
  TokenizeErrorCode,
  TokenizeResult,
  VaultDetails,
  VaultType,
} from '../core/types';
import { SDK_VERSION } from './version';

/*
 * Payment Method Session logging, one instance per session (a <HyperPaymentMethodSession> mount or
 * an initPaymentMethodSession() call), so every event of a checkout shares one session_id.
 *
 * What is logged is fixed by the call sites below: field names, the vault type, error codes, the
 * payment-method-session id, request URLs, HTTP status codes and a backend error's type and code.
 * Card data, the sdkAuthorization, vault credentials, tokens and error messages from a backend
 * are never passed in. Event names and value shapes match hyperswitch-web.
 *
 * Events logged before `configure` (the merchant's `hyper` can be a promise) are queued by the
 * logger and sent once the publishable key is known; a session that never gets one sends nothing.
 */

export const TELEMETRY_SOURCE = 'PAYMENT_METHODS_SDK';

/* The fields DATA_FILLED waits for, in the order it lists them; the name is optional. */
const REQUIRED_FIELDS: readonly ElementType[] = [
  'cardNumber',
  'cardExpiry',
  'cardCvc',
];

/* What a TOKENIZE line may name. A custom adapter (registerAdapter) can return anything, so its vault
   type and error code are logged only when they are one of these; Record keeps the lists complete. */
const KNOWN_VAULT_TYPES: Record<VaultType, true> = {
  hyperswitch: true,
  vgs: true,
  skyflow: true,
  basis_theory: true,
  evervault: true,
};

const KNOWN_ERROR_CODES: Record<TokenizeErrorCode, true> = {
  validation_error: true,
  incomplete_field_set: true,
  sdk_not_ready: true,
  unsupported_configuration: true,
  session_expired: true,
  session_consumed: true,
  invalid_session: true,
  unknown_outcome: true,
  tokenization_failed: true,
};

function isKnown<K extends string>(
  known: Record<K, true>,
  value: unknown
): value is K {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(known, value)
  );
}

const knownVaultType = (value: unknown): VaultType | undefined =>
  isKnown(KNOWN_VAULT_TYPES, value) ? value : undefined;

/* Results whose error message is the Hyperswitch vault's own fixed text, marked by its adapter.
   Every other message can embed configuration or provider output, so it is never logged. */
const vaultMessages = new WeakSet<object>();

export function trustVaultMessage<T extends object>(result: T): T {
  vaultMessages.add(result);
  return result;
}

/* The payment-method-session id, from the sdkAuthorization or the Hyperswitch vault's. */
export function paymentMethodSessionIdOf(
  sdkAuthorization: string | undefined,
  vaultDetails: VaultDetails | undefined
): string {
  const vaultData = vaultDetails?.vaultData as
    { sdkAuthorization?: unknown } | undefined;
  const authorization =
    sdkAuthorization ??
    (vaultDetails?.vaultType === 'hyperswitch' &&
    typeof vaultData?.sdkAuthorization === 'string'
      ? vaultData.sdkAuthorization
      : undefined);
  if (!authorization) return '';
  try {
    return (
      parseAuthorizationClaims(authorization)?.payment_method_session_id ?? ''
    );
  } catch {
    return '';
  }
}

export type ApiFailureReason = 'timeout' | 'aborted' | 'network_error';

const FAILURE_REASONS: ReadonlySet<string> = new Set<ApiFailureReason>([
  'timeout',
  'aborted',
  'network_error',
]);

/* One backend endpoint's PAYMENT_METHOD_SESSION_*_CALL_INIT / *_CALL pair. */
export interface ApiTelemetry {
  /* Logs the _INIT event and returns the time the response is measured from. */
  request(url: string): number;

  /* `errorBody` is read only for a non-2xx response; a 2xx body is never logged. */
  response(
    url: string,
    startedAt: number,
    status: number,
    errorBody?: unknown
  ): void;

  /* No response at all; logged as status 504, as client-core does. */
  failure(url: string, startedAt: number, reason: ApiFailureReason): void;
}

/* Handed to a provider adapter's tokenize(). */
export interface AdapterTelemetry {
  /* VGS_VAULT_FLOW: the status code of the VGS submit, nothing from its body; null when the
     submit failed without one (a network failure), as web logs it. */
  vgsSubmitStatus(status: number | null): void;
}

export interface Telemetry {
  readonly sessionId: string;
  configure(hyper: HyperswitchConfiguration): void;
  /* Web logs {url, pmSessionId}; an app has no URL, so the entry point stands in for it. */
  initiated(entry: string, pmSessionId: string): void;
  /* Web's rule: each mount logs MOUNTED, then RENDERED timed from it, and unmounting a field
     that rendered forgets it, so mounting it again logs a fresh pair. A field unmounted before
     it rendered keeps its first mount: that is the SDK's own remount (the form re-parenting its
     children when the vault arrives) or StrictMode's double mount, not the merchant's. */
  fieldMounted(field: ElementType): void;
  fieldRendered(field: ElementType): void;
  fieldUnmounted(field: ElementType): void;
  /* Web's rule: once the mounted card fields are complete (listing the name too when it is),
     and once more if the name completes later. */
  dataFilled(
    mounted: readonly ElementType[],
    isComplete: (field: ElementType) => boolean
  ): void;
  tokenizeInitiated(vaultType: VaultType | undefined): void;
  tokenizeOutcome(
    result: TokenizeResult,
    vaultType: VaultType | undefined
  ): void;
  readonly retrieveCall: ApiTelemetry;
  readonly adapter: AdapterTelemetry;

  /* The Hyperswitch vault's `logSink`: its CONFIRM / UPDATE calls, in this session. */
  readonly vaultLogSink: (event: unknown) => void;
  readonly crash: (error: unknown) => void;
  dispose(): void;
}

const isOk = (status: number) => status >= 200 && status < 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type VaultEventName =
  | 'PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT'
  | 'PAYMENT_METHOD_SESSION_CONFIRM_CALL'
  | 'PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT'
  | 'PAYMENT_METHOD_SESSION_UPDATE_CALL';

/* Only the vault's own call events are accepted from its sink, rebuilt field by field. */
const VAULT_EVENTS: ReadonlySet<string> = new Set<VaultEventName>([
  'PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT',
  'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
  'PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT',
  'PAYMENT_METHOD_SESSION_UPDATE_CALL',
]);

export interface VaultApiEvent {
  eventName: VaultEventName;
  apiLogType: 'Request' | 'Response' | 'Err' | 'NoResponse';
  url: string;
  statusCode: string;
  latency?: number;
  data?: unknown;
}

export function sanitizeVaultEvent(raw: unknown): VaultApiEvent | undefined {
  if (!isRecord(raw)) return undefined;
  const { eventName, apiLogType, url, statusCode, latency, data } = raw;
  if (typeof eventName !== 'string' || !VAULT_EVENTS.has(eventName)) {
    return undefined;
  }
  if (typeof url !== 'string' || typeof statusCode !== 'string') {
    return undefined;
  }
  const timing = typeof latency === 'number' ? { latency } : {};
  const base = {
    eventName: eventName as VaultEventName,
    url,
    statusCode,
    ...timing,
  };

  switch (apiLogType) {
    case 'Request':
    case 'Response':
      return { ...base, apiLogType };
    case 'Err':
      return { ...base, apiLogType, data: safeErrorResponse(data ?? null) };
    case 'NoResponse': {
      const reason =
        isRecord(data) &&
        typeof data.error === 'string' &&
        FAILURE_REASONS.has(data.error)
          ? data.error
          : 'network_error';
      return { ...base, apiLogType, data: { error: reason } };
    }
    default:
      return undefined;
  }
}

const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/* The merchant's endpoints, from their string fields alone: JavaScript callers can pass `{}`,
   `{ overrideEndpoints: undefined }` or null parts (a conditional config). Both fields go through
   and the logger resolves them in the backend's order: commonEndpoint first. */
function endpointsOf(
  hyper: HyperswitchConfiguration
): customEndpoints | undefined {
  const custom: unknown = hyper.customEndpoints;
  if (!isRecord(custom)) return undefined;
  const commonEndpoint = stringOf(custom.commonEndpoint);
  const override = isRecord(custom.overrideEndpoints)
    ? custom.overrideEndpoints
    : undefined;
  const customBackendEndpoint = stringOf(override?.customBackendEndpoint);
  const customLoggingEndpoint = stringOf(override?.customLoggingEndpoint);
  return {
    ...(commonEndpoint !== undefined ? { commonEndpoint } : {}),
    ...(override
      ? {
          overrideEndpoints: {
            ...(customBackendEndpoint !== undefined
              ? { customBackendEndpoint }
              : {}),
            ...(customLoggingEndpoint !== undefined
              ? { customLoggingEndpoint }
              : {}),
          },
        }
      : {}),
  };
}

/* Telemetry must never break the flow it observes. */
function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    /* ignored */
  }
}

export function createTelemetry(): Telemetry {
  const logger = createLogger();
  const sessionId = generateSessionId();
  let initiated = false;
  let filled = false;
  let nameFilled = false;
  /* Mounted fields: when each mounted and whether it has rendered since. */
  const fieldState = new Map<
    ElementType,
    { mountedAt: number; rendered: boolean }
  >();

  const event = (
    name: eventName,
    value: string,
    type: logType = 'INFO',
    latency?: number
  ) =>
    safely(() =>
      logger.log({
        logType: type,
        category: 'USER_EVENT',
        eventName: name,
        value,
        ...(latency !== undefined ? { latency } : {}),
      })
    );

  const apiCall = (initEvent: eventName, name: eventName): ApiTelemetry => ({
    request(url) {
      safely(() =>
        logger.logApi({
          eventName: initEvent,
          apiLogType: 'Request',
          url,
          statusCode: '',
        })
      );
      return Date.now();
    },
    response(url, startedAt, status, errorBody) {
      const latency = Date.now() - startedAt;
      safely(() =>
        logger.logApi(
          isOk(status)
            ? {
                eventName: name,
                apiLogType: 'Response',
                url,
                statusCode: String(status),
                latency,
              }
            : {
                eventName: name,
                apiLogType: 'Err',
                url,
                statusCode: String(status),
                latency,
                data: safeErrorResponse(errorBody ?? null),
              }
        )
      );
    },
    failure(url, startedAt, reason) {
      const latency = Date.now() - startedAt;
      safely(() =>
        logger.logApi({
          eventName: name,
          apiLogType: 'NoResponse',
          url,
          statusCode: '504',
          latency,
          data: { error: reason },
        })
      );
    },
  });

  return {
    sessionId,

    /* Wholly inside safely(): `hyper` can come from JavaScript in any shape, and a logging step
       must not throw into the session it describes. */
    configure(hyper) {
      safely(() => {
        const publishableKey = stringOf(hyper?.publishableKey)?.trim();
        if (!publishableKey) return;
        const endpoints = endpointsOf(hyper);
        logger.configure({
          publishableKey,
          environment: environmentOf(hyper.environment),
          ...(endpoints ? { customEndpoints: endpoints } : {}),
          sessionId,
          sdkVersion: SDK_VERSION,
          source: TELEMETRY_SOURCE,
        });
      });
    },

    /* Every method below runs wholly inside safely(): telemetry must never turn the flow it
       observes into a throw. */
    initiated(entry, pmSessionId) {
      safely(() => {
        if (initiated) return;
        initiated = true;
        event(
          'PAYMENT_METHOD_SESSION_INITIATED',
          JSON.stringify({ entry, pmSessionId })
        );
      });
    },

    fieldMounted(field) {
      safely(() => {
        const current = fieldState.get(field);
        if (current && !current.rendered) return;
        fieldState.set(field, { mountedAt: Date.now(), rendered: false });
        event('PAYMENT_METHOD_SESSION_FIELD_MOUNTED', field);
      });
    },

    fieldRendered(field) {
      safely(() => {
        const current = fieldState.get(field);
        if (!current || current.rendered) return;
        current.rendered = true;
        event(
          'PAYMENT_METHOD_SESSION_FIELD_RENDERED',
          field,
          'INFO',
          Math.max(0, Math.round(Date.now() - current.mountedAt))
        );
      });
    },

    fieldUnmounted(field) {
      safely(() => {
        if (fieldState.get(field)?.rendered) fieldState.delete(field);
      });
    },

    dataFilled(mounted, isComplete) {
      safely(() => {
        const required = REQUIRED_FIELDS.filter((field) =>
          mounted.includes(field)
        );
        if (required.length === 0 || !required.every(isComplete)) return;
        const nameComplete =
          mounted.includes('cardholderName') && isComplete('cardholderName');
        if (filled && (!nameComplete || nameFilled)) return;
        filled = true;
        nameFilled = nameComplete;
        event(
          'PAYMENT_METHOD_SESSION_DATA_FILLED',
          (nameComplete ? [...required, 'cardholderName'] : required).join(',')
        );
      });
    },

    tokenizeInitiated(vaultType) {
      safely(() =>
        event(
          'PAYMENT_METHOD_SESSION_TOKENIZE_INIT',
          knownVaultType(vaultType) ?? 'unknown'
        )
      );
    },

    /* One outcome per tokenize, timed from TOKENIZE_INIT by the logger. `result` comes from an
       adapter, possibly a merchant's own, so its shape is not assumed: an unknown code is logged
       as tokenization_failed and an unknown vault type as "unknown". */
    tokenizeOutcome(result, vaultType) {
      safely(() => {
        const type =
          knownVaultType(result?.vaultType) ??
          knownVaultType(vaultType) ??
          'unknown';
        if (result?.status === 'success') {
          event(
            'PAYMENT_METHOD_SESSION_TOKENIZE',
            JSON.stringify({ vaultType: type })
          );
          return;
        }
        const error: unknown = (result as { error?: unknown } | undefined)
          ?.error;
        const code =
          isRecord(error) && isKnown(KNOWN_ERROR_CODES, error.code)
            ? error.code
            : 'tokenization_failed';
        const message =
          vaultMessages.has(result) &&
          isRecord(error) &&
          typeof error.message === 'string'
            ? error.message
            : '';
        event(
          'PAYMENT_METHOD_SESSION_TOKENIZE',
          JSON.stringify({ vaultType: type, code, message }),
          'ERROR'
        );
      });
    },

    retrieveCall: apiCall(
      'PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT',
      'PAYMENT_METHOD_SESSION_RETRIEVE_CALL'
    ),

    adapter: {
      vgsSubmitStatus(status) {
        safely(() => {
          const code =
            typeof status === 'number' && Number.isFinite(status)
              ? status
              : null;
          event(
            'VGS_VAULT_FLOW',
            `VGS submit status: ${code}`,
            code !== null && isOk(code) ? 'INFO' : 'ERROR'
          );
        });
      },
    },

    vaultLogSink: (raw) => {
      safely(() => {
        const sanitized = sanitizeVaultEvent(raw);
        if (sanitized) logger.logApi(sanitized);
      });
    },

    crash: (error) => safely(() => logger.logCrash(error)),

    dispose() {
      safely(() => logger.dispose());
    },
  };
}

/* Runs `fn` once the next frame is drawn; the returned function cancels it. */
export function afterNextFrame(fn: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const frame = requestAnimationFrame(() => fn());
    return () => cancelAnimationFrame(frame);
  }
  const timer = setTimeout(fn, 0);
  return () => clearTimeout(timer);
}
