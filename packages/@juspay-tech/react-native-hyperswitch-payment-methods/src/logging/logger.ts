import { AppState, Platform } from 'react-native';

import { parseAuthorizationClaims } from '../session/sdkAuthorization';
import { SDK_VERSION } from './version';

/* This package's logs, in hyperswitch-web's structure (HyperLogger, LoggerUtils.logApi) and the
   vault's: the same record and API values, queued and sent as one batch. A log never carries a
   card value, a request body, a token or the sdkAuthorization, and logging never throws. */

export type LogType = 'DEBUG' | 'INFO' | 'ERROR';

export type LogCategory = 'API' | 'USER_EVENT' | 'USER_ERROR';

export type EventName =
  | 'PAYMENT_METHOD_SESSION_INITIATED'
  | 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT'
  | 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL'
  | 'REQUIRED_PARAMETER'
  | 'INVALID_FORMAT'
  | 'CARD_FORM_FLOW'
  | 'PAYMENT_METHOD_SESSION_FIELD_MOUNTED'
  | 'PAYMENT_METHOD_SESSION_FIELD_RENDERED'
  | 'PAYMENT_METHOD_SESSION_DATA_FILLED'
  | 'CLEAR'
  | 'PAYMENT_METHOD_SESSION_TOKENIZE_INIT'
  | 'PAYMENT_METHOD_SESSION_TOKENIZE'
  | 'VGS_VAULT_FLOW'
  | 'SDK_CRASH';

/* As web's LoggerUtils.apiEventInitMapper and the vault's: the event an API call logs before its
   request is sent. */
function apiEventInitMapper(eventName: EventName): EventName | undefined {
  switch (eventName) {
    case 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL':
      return 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT';
    default:
      return undefined;
  }
}

export const LOG_SOURCE = 'HYPERSWITCH_PAYMENT_METHODS';

export interface LogEntry {
  eventName: EventName;
  value: string;
  logType?: LogType;
  category?: LogCategory;
  /* How long the event took, in ms, measured by the caller from its own start: an API call's
     request, a tokenize's TOKENIZE_INIT, a field's mount. Web works it out from the event's _INIT
     log instead (calculateLatencyHook). */
  latency?: number;
}

/* The session a log belongs to. An API answer, or a tokenize's outcome, keeps the one its
   request started in. */
export interface Identity {
  sessionId: string;
  merchantId: string;
  paymentId: string;
}

interface LogRecord extends Identity {
  timestamp: number;
  logType: LogType;
  category: LogCategory;
  value: string;
  eventName: EventName;
  latency: string;
  firstEvent: boolean;
}

/* HyperLogger.logFileToObj, as the vault fills it for an app: no browser, so browser_name and
   browser_version are left out (both are nullable downstream). */
export function recordToJson(
  record: LogRecord,
  platform: string
): Record<string, string> {
  return {
    timestamp: String(record.timestamp),
    log_type: record.logType,
    component: 'MOBILE',
    category: record.category,
    source: LOG_SOURCE,
    version: SDK_VERSION,
    value: record.value,
    session_id: record.sessionId,
    merchant_id: record.merchantId,
    payment_id: record.paymentId,
    app_id: '',
    platform,
    user_agent: '',
    event_name: record.eventName,
    latency: record.latency,
    first_event: record.firstEvent ? 'true' : 'false',
    payment_method: '',
  };
}

export type LogTransport = (url: string, body: string) => void;

/* web's beaconApiCall, over fetch: the batch as one JSON array, sent as text with no auth header.
   A batch that cannot be sent is dropped. */
const fetchTransport: LogTransport = (url, body) => {
  fetch(url, { method: 'POST', body }).then(
    () => undefined,
    () => undefined
  );
};

let transport: LogTransport = fetchTransport;

/* For tests: where batches go instead of fetch. No argument puts fetch back. */
export function setLogTransport(next?: LogTransport): void {
  transport = next ?? fetchTransport;
}

/* Any run of twelve or more digits, the shape of a card number, with any number of spaces, line
   breaks, dots, slashes or dashes between the digits. Separators and digits never overlap, so the
   match takes time in proportion to the text. */
export function redactDigits(text: string): string {
  return text.replace(/\d(?:[\s./-]*\d){11,}/g, '[redacted]');
}

/* An error's text as it is logged: a card-number shape is blanked as above, then every run of
   three or more digits is sent as stars, one per digit. An error code's two digits are kept. */
export function maskNumbers(text: string): string {
  return redactDigits(text).replace(/\d{3,}/g, (digits) =>
    '*'.repeat(digits.length)
  );
}

/* The fixed messages logged in place of what cannot be logged as it is. */
export const NOT_JSON = 'The response body is not JSON';
export const UNRECOGNISED_ERROR_BODY =
  'The error response is not in the expected format';
export const NOT_AN_ERROR = 'A value that is not an Error was thrown';
export const NO_ERROR_MESSAGE = 'The error has no message';

/* The backend's typed error: {"error": {type, code, message, reason}}. */
const TYPED_ERROR_FIELDS = ['type', 'code', 'message', 'reason'] as const;
/* The fields an error body of another shape, such as a proxy's, commonly has at its top level. */
const TOP_LEVEL_ERROR_FIELDS = [
  'message',
  'error',
  'error_code',
  'error_message',
  'code',
  'type',
  'reason',
] as const;
const MAX_KEYS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* The named fields that are strings, each through maskNumbers; undefined when there are none. */
function maskedStrings(
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const field = source[key];
    if (typeof field === 'string') out[key] = maskNumbers(field);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/* What an API error body is logged as: the body with only known fields left, each only when it is
   a string, and every one through maskNumbers. First the backend's typed error, in its shape;
   failing that, the common top-level fields; failing that, a fixed message with the names of the
   body's top-level keys (never their values). Anything else in the body (data, payment_id,
   connector ids) is left out, and a body that is not an object is logged as the fixed message. */
export function errorBodyValue(body: unknown): Record<string, unknown> {
  try {
    if (isRecord(body)) {
      const typed = isRecord(body.error)
        ? maskedStrings(body.error, TYPED_ERROR_FIELDS)
        : undefined;
      if (typed) return { error: typed };
      const topLevel = maskedStrings(body, TOP_LEVEL_ERROR_FIELDS);
      if (topLevel) return topLevel;
      const keys = Object.keys(body).slice(0, MAX_KEYS).map(maskNumbers);
      if (keys.length > 0) return { message: UNRECOGNISED_ERROR_BODY, keys };
    }
  } catch {
    /* A body whose fields cannot be read is one of another shape. */
  }
  return { message: UNRECOGNISED_ERROR_BODY };
}

/* A property of what was thrown when it is a string. A getter that throws reads as absent. */
function stringProperty(thrown: object, key: string): string | undefined {
  try {
    const value = (thrown as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

function isError(thrown: unknown): thrown is Error {
  try {
    return thrown instanceof Error;
  } catch {
    return false;
  }
}

/* What an exception is logged as: its type and its message, both through maskNumbers; a missing
   or empty message is logged as a fixed one. Never its stack, which in a debug build carries the
   bundle's localhost or IP address URL that the log endpoint's WAF refuses. Any other value thrown
   is logged as a fixed message, since it can carry anything. */
export function exceptionValue(thrown: unknown): Record<string, string> {
  if (!isError(thrown)) return { message: NOT_AN_ERROR };
  const name = stringProperty(thrown, 'name')?.trim();
  const message = stringProperty(thrown, 'message')?.trim();
  return {
    type: name ? maskNumbers(name) : 'Error',
    message: message ? maskNumbers(message) : NO_ERROR_MESSAGE,
  };
}

function newSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (symbol) => {
    const random = Math.floor(Math.random() * 16);
    return (symbol === 'x' ? random : 8 + (random % 4)).toString(16);
  });
}

/* The three points at which web's fetchApiWithLogging logs: before the request, on its answer,
   and when no answer arrives. */
export interface ApiCallLog {
  started(): void;
  answered(status: number): void;
  failed(status: number, response: unknown): void;
  unreadable(status: number): void;
  unanswered(error: unknown): void;
}

export interface Logger {
  readonly url: string | undefined;
  readonly sessionId: string;
  readonly merchantId: string;
  readonly paymentId: string;
  /* Names the merchant and the payment-method session every later log carries. A session that
     replaces another starts afresh, as web loads its frames afresh for each: a new session_id,
     first_event and per-event counts. */
  identify(sdkAuthorization: unknown, publishableKey: unknown): void;
  /* A copy of the session logs are filed under now, for an operation that awaits to keep, as an
     API call does. */
  currentIdentity(): Identity;
  /* from: the session the log belongs to, if not the current one. */
  log(entry: LogEntry, from?: Identity): void;
  apiCall(eventName: EventName, url: string): ApiCallLog;
  /* Sends everything queued: web does when the page unloads, this package when a form or
     session closes and when the app leaves the foreground. */
  sendLogs(): void;
}

/* The sdkAuthorization a Hyperswitch vaultDetails carries in its vaultData, for a merchant who
   passes vaultDetails without sdkAuthorization: it names the same payment-method session. Other
   vaults carry no session id. */
export function vaultDetailsAuthorization(vaultDetails: unknown): string {
  if (typeof vaultDetails !== 'object' || vaultDetails === null) return '';
  const { vaultType, vaultData } = vaultDetails as {
    vaultType?: unknown;
    vaultData?: unknown;
  };
  if (vaultType !== 'hyperswitch') return '';
  if (typeof vaultData !== 'object' || vaultData === null) return '';
  const { sdkAuthorization } = vaultData as { sdkAuthorization?: unknown };
  return typeof sdkAuthorization === 'string' ? sdkAuthorization : '';
}

/* As web's manageErrorWarning(REQUIRED_PARAMETER): the parameter named, never a value. */
export const MISSING_AUTHORIZATION =
  'INTEGRATION ERROR: sdkAuthorization is a required field/parameter or sdkAuthorization cannot be empty';

/* As web's initPaymentMethodSession: the session starting, or the parameter it lacks. */
export function logSessionStart(
  logger: Logger,
  entry: 'HyperPaymentMethodSession' | 'initPaymentMethodSession',
  hasSession: boolean
): void {
  logger.log(
    hasSession
      ? {
          eventName: 'PAYMENT_METHOD_SESSION_INITIATED',
          value: JSON.stringify({ entry, pmSessionId: logger.paymentId }),
        }
      : {
          eventName: 'REQUIRED_PARAMETER',
          value: MISSING_AUTHORIZATION,
          logType: 'ERROR',
          category: 'USER_ERROR',
        }
  );
}

/* As web's maxLogsPushedPerEventName. */
const MAX_LOGS_PER_EVENT = 100;
const SEND_AFTER_MS = 20_000;

/* Loggers with something queued or a send scheduled. */
const queued = new Set<Logger>();
let watchingAppState = false;

/* Sends what every logger has queued: when the app leaves the foreground, and after each test. */
export function sendQueuedLogs(): void {
  queued.forEach((logger) => logger.sendLogs());
}

function watchAppState(): void {
  if (watchingAppState) return;
  watchingAppState = true;
  try {
    AppState.addEventListener('change', (state) => {
      if (state !== 'active') sendQueuedLogs();
    });
  } catch {
    watchingAppState = false;
  }
}

/* One per payment-method session. Without a URL it logs nothing. */
export function createLogger(url: string | undefined): Logger {
  const platform = String(Platform.OS).toUpperCase();
  const queue: LogRecord[] = [];
  const events = new Map<string, number>();
  const counts = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let authorization = '';
  let publishable = '';
  const identity: Identity = {
    sessionId: newSessionId(),
    merchantId: '',
    paymentId: '',
  };

  function sendLogs(): void {
    try {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      queued.delete(logger);
      if (url === undefined || queue.length === 0) return;
      const batch = queue.splice(0, queue.length);
      transport(
        url,
        JSON.stringify(batch.map((record) => recordToJson(record, platform)))
      );
    } catch {
      /* A batch that cannot be sent is dropped. */
    }
  }

  function push(entry: LogEntry, from?: Identity): void {
    if (url === undefined) return;
    const timestamp = Date.now();
    const key = entry.eventName;
    /* A log that belongs to a session this logger has since left keeps that session's identity,
       and leaves the current session's first_event alone. */
    const current = !from || from.sessionId === identity.sessionId;
    /* Errors have their own allowance, so a form's lifecycle logs cannot crowd out its failures
       under the same event name. */
    const capKey = entry.logType === 'ERROR' ? `${key}|ERROR` : key;
    const count = (counts.get(capKey) ?? 0) + 1;
    counts.set(capKey, count);
    if (count <= MAX_LOGS_PER_EVENT) {
      queue.push({
        ...(from ?? identity),
        timestamp,
        logType: entry.logType ?? 'INFO',
        category: entry.category ?? 'USER_EVENT',
        value: entry.value,
        eventName: key,
        latency: entry.latency !== undefined ? String(entry.latency) : '',
        firstEvent: current && !events.has(key),
      });
    }
    /* As web's checkLogSizeAndSendData: an error goes out at once, and so does a queue of more
       than 8. None of these events is on web's priority list. */
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(sendLogs, SEND_AFTER_MS);
    queued.add(logger);
    watchAppState();
    if (queue.length > 8 || queue.some((log) => log.logType === 'ERROR')) {
      sendLogs();
    }
    if (current) events.set(key, timestamp);
  }

  function startNewSession(): void {
    sendLogs();
    identity.sessionId = newSessionId();
    events.clear();
    counts.clear();
  }

  const logger: Logger = {
    url,
    get sessionId() {
      return identity.sessionId;
    },
    get merchantId() {
      return identity.merchantId;
    },
    get paymentId() {
      return identity.paymentId;
    },

    identify(sdkAuthorization, publishableKey) {
      try {
        const next =
          typeof sdkAuthorization === 'string' ? sdkAuthorization.trim() : '';
        const key =
          typeof publishableKey === 'string' ? publishableKey.trim() : '';
        if (next === '' || next === authorization) {
          if (key === publishable) return;
        } else if (authorization !== '') {
          startNewSession();
        }
        if (next !== '') authorization = next;
        publishable = key;
        const claims = authorization
          ? parseAuthorizationClaims(authorization)
          : undefined;
        identity.merchantId = claims?.publishable_key ?? publishable;
        identity.paymentId = claims?.payment_method_session_id ?? '';
      } catch {
        /* Logs keep the identity they had. */
      }
    },

    currentIdentity() {
      return { ...identity };
    },

    log(entry, from) {
      try {
        push(entry, from);
      } catch {
        /* Logging never changes what the SDK does. */
      }
    },

    apiCall(eventName, callUrl) {
      const from: Identity = { ...identity };
      let startedAt: number | undefined;
      const answer = (
        logType: LogType,
        value: Record<string, unknown>
      ): void => {
        try {
          const latency = startedAt === undefined ? 0 : Date.now() - startedAt;
          push(
            {
              eventName,
              value: JSON.stringify({ url: callUrl, ...value }),
              logType,
              category: 'API',
              ...(latency > 0 ? { latency } : {}),
            },
            from
          );
        } catch {
          /* Logging never changes what the SDK does. */
        }
      };
      return {
        started() {
          try {
            startedAt = Date.now();
            const initEventName = apiEventInitMapper(eventName);
            if (initEventName === undefined) return;
            push(
              {
                eventName: initEventName,
                value: JSON.stringify({ url: callUrl }),
                category: 'API',
              },
              from
            );
          } catch {
            /* Logging never changes what the SDK does. */
          }
        },
        answered(status) {
          answer('INFO', { statusCode: status });
        },
        failed(status, response) {
          answer('ERROR', {
            statusCode: status,
            response: errorBodyValue(response),
          });
        },
        unreadable(status) {
          answer('ERROR', {
            statusCode: status,
            response: { message: NOT_JSON },
          });
        },
        unanswered(error) {
          answer('ERROR', { statusCode: 504, response: exceptionValue(error) });
        },
      };
    },

    sendLogs,
  };

  return logger;
}
