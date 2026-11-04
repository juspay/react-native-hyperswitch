import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';
import { AppState } from 'react-native';

import {
  createLogger,
  formatThrown,
  redactCardNumbers,
  setLogTransport,
} from '../logger';
import { loggingUrl } from '../loggingUrl';
import { SDK_VERSION } from '../version';

const LOG_URL = 'https://logs.example/logs/sdk';
const AUTH = Buffer.from(
  'publishable_key=pk_snd_logs,payment_method_session_id=0a_pms_logs,profile_id=pro_1',
  'utf8'
).toString('base64');
const OTHER_AUTH = Buffer.from(
  'publishable_key=pk_snd_logs,payment_method_session_id=0a_pms_other',
  'utf8'
).toString('base64');

let batches: Array<Array<Record<string, string>>>;
let urls: string[];

beforeEach(() => {
  batches = [];
  urls = [];
  setLogTransport((url, body) => {
    urls.push(url);
    batches.push(JSON.parse(body));
  });
});

afterEach(() => {
  setLogTransport(() => {});
  jest.useRealTimers();
});

const logs = () => batches.flat();

describe('the record', () => {
  it('has web’s fields, as the vault fills them for an app', () => {
    const logger = createLogger(LOG_URL);
    logger.identify(AUTH, 'pk_ignored');
    logger.log({ eventName: 'CARD_FORM_FLOW', value: 'Card form created' });
    logger.sendLogs();

    const [record] = logs();
    expect(Object.keys(record!)).toEqual([
      'timestamp',
      'log_type',
      'component',
      'category',
      'source',
      'version',
      'value',
      'session_id',
      'merchant_id',
      'payment_id',
      'app_id',
      'platform',
      'user_agent',
      'event_name',
      'latency',
      'first_event',
      'payment_method',
    ]);
    expect(record).toMatchObject({
      log_type: 'INFO',
      component: 'MOBILE',
      category: 'USER_EVENT',
      source: 'HYPERSWITCH_PAYMENT_METHODS',
      version: SDK_VERSION,
      value: 'Card form created',
      merchant_id: 'pk_snd_logs',
      payment_id: '0a_pms_logs',
      app_id: '',
      platform: 'IOS',
      user_agent: '',
      event_name: 'CARD_FORM_FLOW',
      latency: '',
      first_event: 'true',
      payment_method: '',
    });
    expect(record!.session_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(urls).toEqual([LOG_URL]);
  });

  it('carries the version in package.json', () => {
    const pkg = require('../../../package.json') as { version: string };
    expect(SDK_VERSION).toBe(pkg.version);
  });

  it('names the merchant by the instance’s key when the authorization has none', () => {
    const logger = createLogger(LOG_URL);
    logger.identify(undefined, ' pk_snd_instance ');
    expect(logger.merchantId).toBe('pk_snd_instance');
    expect(logger.paymentId).toBe('');
  });
});

describe('sending', () => {
  it('queues logs and sends them as one batch 20 s after the last one', () => {
    jest.useFakeTimers();
    const logger = createLogger(LOG_URL);
    logger.log({ eventName: 'CARD_FORM_FLOW', value: 'Card form created' });
    jest.advanceTimersByTime(15_000);
    logger.log({
      eventName: 'PAYMENT_METHOD_SESSION_FIELD_MOUNTED',
      value: 'cardNumber',
    });
    jest.advanceTimersByTime(15_000);
    expect(batches).toHaveLength(0);
    jest.advanceTimersByTime(5_000);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it('sends at once on an error, and when more than 8 are queued', () => {
    const logger = createLogger(LOG_URL);
    logger.log({ eventName: 'CARD_FORM_FLOW', value: 'Card form created' });
    logger.log({
      eventName: 'REQUIRED_PARAMETER',
      value: 'sdkAuthorization',
      logType: 'ERROR',
      category: 'USER_ERROR',
    });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);

    for (let i = 0; i < 9; i += 1)
      logger.log({ eventName: 'CLEAR', value: 'cardCvc' });
    expect(batches).toHaveLength(2);
    expect(batches[1]).toHaveLength(9);
  });

  it('sends at most 100 logs per event in a session, as web', () => {
    const logger = createLogger(LOG_URL);
    for (let i = 0; i < 150; i += 1)
      logger.log({ eventName: 'CLEAR', value: 'cardCvc' });
    logger.sendLogs();
    expect(logs()).toHaveLength(100);
  });

  it('gives errors their own allowance under the cap', () => {
    const logger = createLogger(LOG_URL);
    for (let i = 0; i < 120; i += 1) {
      logger.log({ eventName: 'CARD_FORM_FLOW', value: 'cardCvc unmounted' });
    }
    logger.log({
      eventName: 'CARD_FORM_FLOW',
      value: 'Card form failed: provider_failed',
      logType: 'ERROR',
    });
    logger.sendLogs();
    expect(logs()).toHaveLength(101);
    expect(logs().at(-1)!.log_type).toBe('ERROR');
  });

  it('sends what is queued when the app leaves the foreground', () => {
    const addListener = AppState.addEventListener as unknown as jest.Mock;
    const logger = createLogger(LOG_URL);
    logger.log({ eventName: 'CARD_FORM_FLOW', value: 'Card form created' });
    const onChange = addListener.mock.calls
      .map((call) => call[1] as (state: string) => void)
      .at(-1);
    expect(onChange).toBeDefined();
    onChange!('active');
    expect(batches).toHaveLength(0);
    onChange!('background');
    expect(batches).toHaveLength(1);
  });

  it('sends nothing without a URL', () => {
    const logger = createLogger(undefined);
    logger.log({ eventName: 'SDK_CRASH', value: '{}', logType: 'ERROR' });
    logger.sendLogs();
    expect(batches).toHaveLength(0);
  });

  it('never throws, even when the batch cannot be sent', () => {
    setLogTransport(() => {
      throw new Error('offline');
    });
    const logger = createLogger(LOG_URL);
    expect(() =>
      logger.log({ eventName: 'SDK_CRASH', value: '{}', logType: 'ERROR' })
    ).not.toThrow();
    expect(() => logger.sendLogs()).not.toThrow();
  });

  it('posts the batch with fetch as a JSON array, with no headers', () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(async () => ({ ok: true }));
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    try {
      setLogTransport();
      const logger = createLogger(LOG_URL);
      logger.log({ eventName: 'CLEAR', value: 'cardCvc' });
      logger.sendLogs();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        { method: string; body: string; headers?: unknown },
      ];
      expect(url).toBe(LOG_URL);
      expect(init.method).toBe('POST');
      expect(init.headers).toBeUndefined();
      expect(JSON.parse(init.body)).toHaveLength(1);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });
});

describe('sessions', () => {
  it('first_event is true once per event name', () => {
    const logger = createLogger(LOG_URL);
    logger.log({ eventName: 'CLEAR', value: 'cardCvc' });
    logger.log({ eventName: 'CLEAR', value: 'cardNumber' });
    logger.sendLogs();
    expect(logs().map((log) => log.first_event)).toEqual(['true', 'false']);
  });

  it('keeps the session_id when the first authorization arrives, and starts afresh for another', () => {
    const logger = createLogger(LOG_URL);
    logger.identify(undefined, 'pk_snd_logs');
    const before = logger.sessionId;
    logger.log({ eventName: 'CLEAR', value: 'cardCvc' });

    logger.identify(AUTH, 'pk_snd_logs');
    expect(logger.sessionId).toBe(before);
    expect(logger.paymentId).toBe('0a_pms_logs');
    logger.identify(AUTH, 'pk_snd_logs');
    expect(logger.sessionId).toBe(before);

    logger.identify(OTHER_AUTH, 'pk_snd_logs');
    expect(logger.sessionId).not.toBe(before);
    expect(logger.paymentId).toBe('0a_pms_other');
    /* What was queued went out under the session it belonged to. */
    expect(batches).toHaveLength(1);
    expect(batches[0]![0]!.session_id).toBe(before);

    logger.log({ eventName: 'CLEAR', value: 'cardCvc' });
    logger.sendLogs();
    expect(batches[1]![0]!.first_event).toBe('true');
  });

  it('logs an API call as web’s logApi, with the latency since its _INIT', () => {
    jest.useFakeTimers();
    const logger = createLogger(LOG_URL);
    logger.identify(AUTH, undefined);
    const url =
      'https://app.hyperswitch.io/api/v1/payment-method-sessions/0a_pms_logs';

    const ok = logger.apiCall('PAYMENT_METHOD_SESSION_RETRIEVE_CALL', url);
    ok.started();
    jest.advanceTimersByTime(120);
    ok.answered(200);

    const failed = logger.apiCall('PAYMENT_METHOD_SESSION_RETRIEVE_CALL', url);
    failed.started();
    failed.failed(401, { error: { code: 'IR_01', message: 'Unauthorized' } });

    const lost = logger.apiCall('PAYMENT_METHOD_SESSION_RETRIEVE_CALL', url);
    lost.started();
    lost.unanswered(new TypeError('Network request failed'));
    logger.sendLogs();

    const values = logs().map((log) => [
      log.event_name,
      log.log_type,
      log.category,
      JSON.parse(log.value!),
    ]);
    expect(values).toEqual([
      ['PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT', 'INFO', 'API', { url }],
      [
        'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
        'INFO',
        'API',
        { url, statusCode: 200 },
      ],
      ['PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT', 'INFO', 'API', { url }],
      [
        'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
        'ERROR',
        'API',
        {
          url,
          statusCode: 401,
          response: { error: { code: 'IR_01', message: 'Unauthorized' } },
        },
      ],
      ['PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT', 'INFO', 'API', { url }],
      [
        'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
        'ERROR',
        'API',
        {
          url,
          statusCode: 504,
          response: expect.objectContaining({
            message: 'Network request failed',
            type: 'TypeError',
          }),
        },
      ],
    ]);
    expect(logs()[1]!.latency).toBe('120');
  });

  it('files an answer that arrives after the session changed under the session that sent it', () => {
    const logger = createLogger(LOG_URL);
    logger.identify(AUTH, undefined);
    const first = logger.sessionId;
    const call = logger.apiCall('PAYMENT_METHOD_SESSION_RETRIEVE_CALL', 'u');
    call.started();
    logger.identify(OTHER_AUTH, undefined);
    call.answered(200);
    logger.sendLogs();
    const answer = logs().find(
      (log) => log.event_name === 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL'
    )!;
    expect(answer.session_id).toBe(first);
    expect(answer.payment_id).toBe('0a_pms_logs');
    expect(answer.first_event).toBe('false');
  });
});

describe('what a log may carry', () => {
  it('blanks runs of digits shaped like a card number, however they are spaced', () => {
    expect(
      redactCardNumbers({
        message: 'Card 4242 4242 4242 4242 at line 12:345',
        pan: '4111-1111-1111-1111',
        dotted: '4242.4242.4242.4242',
        digits: 4111111111111111,
        nested: ['5555555555554444'],
      })
    ).toEqual({
      message: 'Card [redacted] at line 12:345',
      pan: '[redacted]',
      dotted: '[redacted]',
      digits: '[redacted]',
      nested: ['[redacted]'],
    });
  });

  it('records an Error as web’s formatException, and anything else as itself', () => {
    expect(formatThrown(new TypeError('bad'))).toEqual(
      expect.objectContaining({ message: 'bad', type: 'TypeError' })
    );
    expect(formatThrown('boom')).toBe('boom');
    expect(formatThrown(null)).toBeNull();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(formatThrown(cyclic)).toBeNull();
  });
});

describe('the log URL, as client-core’s getUrl(#logs)', () => {
  it('follows overrideEndpoints, then commonEndpoint, then the environment', () => {
    expect(loggingUrl('SANDBOX', undefined)).toBe(
      'https://app.hyperswitch.io/api/logs/sdk'
    );
    expect(loggingUrl(undefined, undefined)).toBe(
      'https://live.hyperswitch.io/api/logs/sdk'
    );
    expect(loggingUrl('PROD_EU', null)).toBe(
      'https://eu.hyperswitch.io/api/logs/sdk'
    );
    expect(loggingUrl('INTEG', 5)).toBe(
      'https://integ.hyperswitch.io/api/logs/sdk'
    );
    expect(
      loggingUrl('PROD', { commonEndpoint: ' https://proxy.example/api// ' })
    ).toBe('https://proxy.example/api/logs/sdk');
    expect(
      loggingUrl('PROD', {
        overrideEndpoints: {
          customBackendEndpoint: 'https://backend.example/api',
          customLoggingEndpoint: ' https://logs.example/sdk ',
        },
      })
    ).toBe('https://logs.example/sdk');
    /* overrideEndpoints without a logging endpoint: the environment's. */
    expect(
      loggingUrl('SANDBOX', {
        overrideEndpoints: {
          customBackendEndpoint: 'https://backend.example/api',
        },
      })
    ).toBe('https://app.hyperswitch.io/api/logs/sdk');
    /* As client-core, the URL is used as given. */
    expect(
      loggingUrl('PROD', {
        overrideEndpoints: {
          customLoggingEndpoint: 'http://10.0.2.2:5299/logs',
        },
      })
    ).toBe('http://10.0.2.2:5299/logs');
  });

  it('sends no logs for a blank logging endpoint', () => {
    expect(
      loggingUrl('PROD', { overrideEndpoints: { customLoggingEndpoint: '  ' } })
    ).toBeUndefined();
  });
});
