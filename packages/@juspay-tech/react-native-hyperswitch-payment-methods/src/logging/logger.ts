import { AppState, Platform } from 'react-native';

import { parseAuthorizationClaims } from '../session/sdkAuthorization';
import { SDK_VERSION } from './version';

/* This package's logs, in hyperswitch-web's structure (HyperLogger, LoggerUtils.logApi) and the
   vault's: the same record and API values, queued and sent as one batch. A log never carries a
   card value, a request body, a token or the sdkAuthorization, and logging never throws. */

export type LogType = 'DEBUG' | 'INFO' | 'ERROR';

export type LogCategory = 'API' | 'USER_EVENT' | 'USER_ERROR';

export type ApiEventName = 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL';

export type EventName =
  | 'PAYMENT_METHOD_SESSION_INITIATED'
  | ApiEventName
  | `${ApiEventName}_INIT`
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

export const LOG_SOURCE = 'HYPERSWITCH_PAYMENT_METHODS';

export interface LogEntry {
  eventName: EventName;
  value: string;
  logType?: LogType;
  category?: LogCategory;
  /* Replaces the latency measured from the event's _INIT, as on web. */
  latency?: number;
}

/* The session a log belongs to. An API answer keeps the one its request started in. */
interface Identity {
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

/* Any run of twelve or more digits, the shape of a card number, however it is spaced. Shorter
   numbers, such as a stack's line and column, are kept. */
export function redactDigits(text: string): string {
  return text.replace(/\d(?:[\s./-]{0,2}\d){11,}/g, '[redacted]');
}

export function redactCardNumbers(value: unknown): unknown {
  if (typeof value === 'string') return redactDigits(value);
  if (typeof value === 'number') {
    return Math.abs(value) >= 1e11 ? '[redacted]' : value;
  }
  if (Array.isArray(value)) return value.map(redactCardNumbers);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
      out[key] = redactCardNumbers(field);
    }
    return out;
  }
  return value;
}

/* What was thrown, as web's Utils.formatException records an Error, or the value itself when it
   is not one. A value that cannot be written as JSON is recorded as null. */
export function formatThrown(thrown: unknown): unknown {
  if (thrown === null || thrown === undefined) return null;
  const error = thrown as Partial<Record<string, unknown>>;
  const fields: Array<[string, unknown, string]> = [
    ['message', error.message, 'Unknown Error'],
    ['type', error.name, 'Unknown'],
    ['stack', error.stack, 'Unknown'],
    ['fileName', error.fileName, 'Unknown'],
  ];
  if (fields.some(([, field]) => typeof field === 'string')) {
    const out: Record<string, string> = {};
    for (const [key, field, fallback] of fields) {
      out[key] = typeof field === 'string' ? field : fallback;
    }
    return out;
  }
  try {
    const text = JSON.stringify(thrown);
    return text === undefined ? null : JSON.parse(text);
  } catch {
    return null;
  }
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
  log(entry: LogEntry): void;
  apiCall(eventName: ApiEventName, url: string): ApiCallLog;
  /* Sends everything queued: web does when the page unloads, this package when a form or
     session closes and when the app leaves the foreground. */
  sendLogs(): void;
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

  /* As web's calculateLatencyHook: an answer carries the time since its _INIT. */
  function latencyFromInit(eventName: EventName): string {
    const startedAt = events.get(`${eventName}_INIT`);
    const latency = startedAt === undefined ? 0 : Date.now() - startedAt;
    return latency > 0 ? String(latency) : '';
  }

  function push(entry: LogEntry, from?: Identity): void {
    if (url === undefined) return;
    const timestamp = Date.now();
    const key = entry.eventName;
    /* A log that belongs to a session this logger has since left keeps that session's identity,
       and leaves the current session's first_event and latencies alone. */
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
        latency:
          entry.latency !== undefined
            ? String(entry.latency)
            : current
              ? latencyFromInit(key)
              : '',
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

    log(entry) {
      try {
        push(entry);
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
            push(
              {
                eventName: `${eventName}_INIT`,
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
            response: redactCardNumbers(response),
          });
        },
        unanswered(error) {
          answer('ERROR', {
            statusCode: 504,
            response: redactCardNumbers(formatThrown(error)),
          });
        },
      };
    },

    sendLogs,
  };

  return logger;
}
