/*
 * The shared logger's own rules, against the real (vendored) build: where logs may go, what is
 * redacted at the send step, and what an API log keeps. The vault compiles in the same logger,
 * so these hold for it too.
 */
import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';

jest.unmock('../vendor/hyperswitch-logger');

import {
  createLogger,
  generateSessionId,
  redactSecrets,
  safeErrorResponse,
} from '../vendor/hyperswitch-logger';
import type {
  apiLogEvent,
  customEndpoints,
  environment,
} from '../vendor/hyperswitch-logger';

type Sent = { url: string; init: { body: string } };
const originalFetch = globalThis.fetch;
let sent: Sent[];

beforeEach(() => {
  sent = [];
  (globalThis as { fetch?: unknown }).fetch = jest.fn(
    async (url: string, init: Sent['init']) => {
      sent.push({ url, init });
      return { ok: true, status: 200 };
    }
  );
});

afterEach(() => {
  (globalThis as { fetch?: unknown }).fetch = originalFetch;
});

function configured(
  custom: customEndpoints | undefined,
  env: environment = 'PROD'
) {
  const logger = createLogger();
  logger.configure({
    publishableKey: 'pk_snd_policy',
    environment: env,
    ...(custom ? { customEndpoints: custom } : {}),
    sessionId: 'session',
    sdkVersion: '1.1.0',
    source: 'PAYMENT_METHODS_SDK',
  });
  return logger;
}

/* Where one log line goes, or null when nothing is sent. */
function loggingUrl(
  custom: customEndpoints | undefined,
  env: environment = 'PROD'
): string | null {
  sent = [];
  const logger = configured(custom, env);
  logger.log({
    logType: 'INFO',
    category: 'USER_EVENT',
    eventName: 'PAYMENT_METHOD_SESSION_INITIATED',
    value: 'probe',
  });
  logger.dispose();
  return sent[0]?.url ?? null;
}

function sentBodies() {
  return sent.map((call) => JSON.parse(call.init.body));
}

const PROXY = 'https://proxy.merchant.test/api';
const BACKEND = 'https://api.merchant.test';
const LOGS = 'https://logs.merchant.test/sdk';

describe('the logging URL', () => {
  /* The vault and payment-methods pick their backend from commonEndpoint first, then
     overrideEndpoints.customBackendEndpoint. Logs follow the same order, so they never go to
     Hyperswitch's host while the API calls go somewhere else. */
  const cases: Array<[string, customEndpoints | undefined, string | null]> = [
    [
      'no custom endpoints',
      undefined,
      'https://live.hyperswitch.io/api/logs/sdk',
    ],
    ['an empty object', {}, 'https://live.hyperswitch.io/api/logs/sdk'],
    [
      'an empty override',
      { overrideEndpoints: {} },
      'https://live.hyperswitch.io/api/logs/sdk',
    ],
    ['commonEndpoint', { commonEndpoint: PROXY }, `${PROXY}/logs/sdk`],
    [
      'commonEndpoint with a trailing slash',
      { commonEndpoint: `${PROXY}/` },
      `${PROXY}/logs/sdk`,
    ],
    [
      'commonEndpoint with an empty override',
      { commonEndpoint: PROXY, overrideEndpoints: {} },
      `${PROXY}/logs/sdk`,
    ],
    [
      'commonEndpoint with an asset override',
      {
        commonEndpoint: PROXY,
        overrideEndpoints: { customAssetEndpoint: 'https://cdn.merchant.test' },
      } as customEndpoints,
      `${PROXY}/logs/sdk`,
    ],
    [
      'commonEndpoint with a backend override',
      {
        commonEndpoint: PROXY,
        overrideEndpoints: { customBackendEndpoint: BACKEND },
      },
      `${PROXY}/logs/sdk`,
    ],
    [
      'commonEndpoint with a logging override',
      {
        commonEndpoint: PROXY,
        overrideEndpoints: { customLoggingEndpoint: LOGS },
      },
      `${PROXY}/logs/sdk`,
    ],
    ['a blank commonEndpoint', { commonEndpoint: '  ' }, null],
    [
      'a logging override',
      { overrideEndpoints: { customLoggingEndpoint: LOGS } },
      LOGS,
    ],
    [
      'backend and logging overrides',
      {
        overrideEndpoints: {
          customBackendEndpoint: BACKEND,
          customLoggingEndpoint: LOGS,
        },
      },
      LOGS,
    ],
    [
      'a backend override alone',
      { overrideEndpoints: { customBackendEndpoint: BACKEND } },
      null,
    ],
    [
      'a blank backend override',
      { overrideEndpoints: { customBackendEndpoint: ' ' } },
      null,
    ],
    [
      'a blank logging override',
      { overrideEndpoints: { customLoggingEndpoint: ' ' } },
      null,
    ],
  ];

  it.each(cases)('with %s', (_, custom, expected) => {
    expect(loggingUrl(custom)).toBe(expected);
  });

  it("defaults to Hyperswitch's host for each environment", () => {
    expect(loggingUrl(undefined, 'SANDBOX')).toBe(
      'https://app.hyperswitch.io/api/logs/sdk'
    );
    expect(loggingUrl(undefined, 'INTEG')).toBe(
      'https://integ.hyperswitch.io/api/logs/sdk'
    );
    expect(loggingUrl(undefined, 'production' as environment)).toBe(
      'https://live.hyperswitch.io/api/logs/sdk'
    );
  });

  const logging = (url: string) => ({
    overrideEndpoints: { customLoggingEndpoint: url },
  });

  it('sends only over https, or http to a loopback host outside PROD', () => {
    expect(loggingUrl(logging('http://logs.merchant.test/sdk'))).toBeNull();
    expect(
      loggingUrl(logging('http://logs.merchant.test/sdk'), 'SANDBOX')
    ).toBeNull();
    expect(
      loggingUrl({ commonEndpoint: 'http://proxy.merchant.test' })
    ).toBeNull();
    expect(loggingUrl(logging('http://localhost:5252/logs/sdk'))).toBeNull();
    expect(
      loggingUrl(
        logging('http://localhost:5252/logs/sdk'),
        'production' as environment
      )
    ).toBeNull();
    expect(
      loggingUrl(logging('http://localhost:5252/logs/sdk'), 'SANDBOX')
    ).toBe('http://localhost:5252/logs/sdk');
    expect(loggingUrl(logging('http://10.0.2.2:5252/logs/sdk'), 'INTEG')).toBe(
      'http://10.0.2.2:5252/logs/sdk'
    );
    expect(loggingUrl(logging('ftp://logs.merchant.test/sdk'))).toBeNull();
  });

  it('refuses credentials, a query or a hash', () => {
    for (const url of [
      'https://user:pass@logs.merchant.test/sdk',
      'https://user@logs.merchant.test/sdk',
      'https://logs.merchant.test/sdk?key=1',
      'https://logs.merchant.test/sdk#key',
      'https://logs.merchant.test\\@evil.test/sdk',
      'logs.merchant.test/sdk',
      'https://',
    ]) {
      expect(loggingUrl(logging(url))).toBeNull();
    }
  });

  it('trims trailing slashes in linear time, however many there are', () => {
    expect(
      loggingUrl(logging('https://logs.merchant.test/sdk' + '/'.repeat(50000)))
    ).toBe('https://logs.merchant.test/sdk');
    const inner = 'https://logs.merchant.test/' + '/'.repeat(50000) + 'sdk';
    expect(loggingUrl(logging(inner))).toBe(inner);
  });

  it('normalises the scheme, host and trailing slash', () => {
    expect(loggingUrl(logging(' HTTPS://Logs.Merchant.Test:8443/Sdk/ '))).toBe(
      'https://logs.merchant.test:8443/Sdk'
    );
  });
});

describe('redaction', () => {
  it('finds a card number run together with other digits or grouped by dots', () => {
    for (const text of [
      'Card 4242 4242 4242 4242 123 rejected',
      'card 4242424242424242 1230',
      'ref 12 4242424242424242',
      '4242.4242.4242.4242',
      '4242-4242-4242-4242',
      '9944242424242424242',
    ]) {
      expect(redactSecrets(text)).not.toMatch(/4242/);
    }
  });

  it('finds secrets split by _ - or . and keeps the session ids it may log', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const secret = 'pay_Ab12Cd34Ef56Gh78Ij90_secret_TZjGlzbyR2eZKadNxmLG';
    const base64 = Buffer.from(
      'publishable_key=pk_snd_x,client_secret=cs_0192,payment_method_session_id=12345_pms_0192'
    ).toString('base64');
    for (const token of [jwt, secret, base64, `${base64}/${base64}`]) {
      expect(redactSecrets(`token ${token} end`)).toMatch(
        /^token \[REDACTED\](\.\[REDACTED\])* end$/
      );
    }

    const url =
      'https://live.hyperswitch.io/api/v1/payment-method-sessions/12345_pms_01926c58bc6e77c09e809964e72af8c8/update-saved-payment-method';
    expect(redactSecrets(url)).toBe(url);
  });

  it('runs on every value at the send step', () => {
    const logger = configured(undefined);
    logger.log({
      logType: 'INFO',
      category: 'USER_EVENT',
      eventName: 'PAYMENT_METHOD_SESSION_INITIATED',
      value:
        'a QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9w b 4242 4242 4242 4242',
      internalMetadata: 'c 4111111111111111',
    });
    logger.dispose();

    const [body] = sentBodies();
    expect(body.app_id).toBe('ios');
    expect(body.value).toBe('a [REDACTED] b [REDACTED]');
    expect(body.internal_metadata).toBe('c [REDACTED]');
  });
});

describe('API logs', () => {
  const apiLog = (event: Omit<apiLogEvent, 'eventName'>) => {
    sent = [];
    const logger = configured(undefined);
    logger.logApi({
      eventName: 'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
      ...event,
    });
    logger.dispose();
    const [body] = sentBodies();
    return {
      value: JSON.parse(body.value),
      internalMetadata: JSON.parse(body.internal_metadata),
    };
  };

  it("keep only an error body's type and code, whoever logs it", () => {
    const { value, internalMetadata } = apiLog({
      apiLogType: 'Err',
      url: 'https://proxy.merchant.test/v1/x',
      statusCode: '400',
      data: {
        error: {
          type: 'invalid_request',
          code: 'IR_16',
          message: 'Card 4242 4242 4242 4242 123 rejected',
          reason: 'connector said 4242424242424242',
        },
      },
    });
    expect(value.response).toEqual({
      error: { type: 'invalid_request', code: 'IR_16' },
    });
    expect(internalMetadata.response).toEqual(value.response);
  });

  it('drop a type or code that is not a short identifier', () => {
    expect(
      safeErrorResponse({
        error: {
          type: 'card 4242 4242 4242 4242 declined',
          code: 'x'.repeat(65),
        },
      })
    ).toEqual({ error: {} });
    expect(safeErrorResponse('a 4242424242424242 string')).toBeNull();
  });

  it('keep only a fixed reason for a request that got no response', () => {
    expect(
      apiLog({
        apiLogType: 'NoResponse',
        url: 'https://proxy.merchant.test/v1/x',
        statusCode: '504',
        data: { error: 'timeout' },
      }).value.response
    ).toEqual({ error: 'timeout' });
    expect(
      apiLog({
        apiLogType: 'NoResponse',
        url: 'https://proxy.merchant.test/v1/x',
        statusCode: '504',
        data: { error: 'TypeError: failed at 4242 4242 4242 4242', stack: 'x' },
      }).value.response
    ).toEqual({ error: 'network_error' });
  });

  it('drop credentials, the query and the hash from the URL', () => {
    expect(
      apiLog({
        apiLogType: 'Request',
        url: 'https://user:pass@proxy.merchant.test/v1/x?client_secret=abc#frag',
        statusCode: '',
      }).value.url
    ).toBe('https://proxy.merchant.test/v1/x');
  });
});

describe('generateSessionId', () => {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'crypto', original);
    else delete (globalThis as { crypto?: unknown }).crypto;
  });

  it('draws from crypto.getRandomValues when the runtime has it', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: {
        getRandomValues: (bytes: Uint8Array) => bytes.fill(0xab),
      },
    });
    expect(generateSessionId()).toBe('abababab-abab-4bab-abab-abababababab');
  });

  it('is a version-4 UUID without it', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(generateSessionId()).toMatch(uuid);
    expect(generateSessionId()).not.toBe(generateSessionId());
  });
});
