import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import {
  createTelemetry,
  paymentMethodSessionIdOf,
  sanitizeVaultEvent,
  trustVaultMessage,
} from '../telemetry';
import { errorResult } from '../../core/results';
import type { ElementType } from '../../core/types';
import {
  loggedEvents,
  loggerCalls,
  resetLoggerCalls,
} from '../../__fixtures__/loggerRecorder';
import { SDK_VERSION } from '../version';

beforeEach(resetLoggerCalls);

describe('createTelemetry', () => {
  it('configures the logger from the hyper instance, defaulting to PROD', () => {
    const telemetry = createTelemetry();
    telemetry.configure({
      publishableKey: ' pk_snd_123 ',
      customEndpoints: {
        overrideEndpoints: {
          customBackendEndpoint: 'https://api.merchant.test',
          customLoggingEndpoint: 'https://logs.merchant.test',
          customAssetEndpoint: 'https://assets.merchant.test',
        },
      },
    });

    expect(loggerCalls()).toEqual([
      {
        method: 'configure',
        config: {
          publishableKey: 'pk_snd_123',
          environment: 'PROD',
          customEndpoints: {
            overrideEndpoints: {
              customBackendEndpoint: 'https://api.merchant.test',
              customLoggingEndpoint: 'https://logs.merchant.test',
            },
          },
          sessionId: telemetry.sessionId,
          sdkVersion: SDK_VERSION,
          source: 'PAYMENT_METHODS_SDK',
        },
      },
    ]);
  });

  it('does not configure without a publishable key', () => {
    createTelemetry().configure({ publishableKey: '  ' });
    expect(loggerCalls()).toEqual([]);
  });

  it('passes both endpoint forms on, for the logger to resolve in the backend order', () => {
    createTelemetry().configure({
      publishableKey: 'pk_snd_123',
      environment: 'SANDBOX',
      customEndpoints: {
        commonEndpoint: 'https://proxy.merchant.test/api',
        overrideEndpoints: { customAssetEndpoint: 'https://cdn.merchant.test' },
      } as never,
    });

    expect(loggerCalls()).toEqual([
      expect.objectContaining({
        method: 'configure',
        config: expect.objectContaining({
          environment: 'SANDBOX',
          customEndpoints: {
            commonEndpoint: 'https://proxy.merchant.test/api',
            overrideEndpoints: {},
          },
        }),
      }),
    ]);
  });

  it('never throws, whatever a JavaScript caller passes', () => {
    const shapes: unknown[] = [
      undefined,
      null,
      { publishableKey: 42 },
      { publishableKey: 'pk_snd_123', customEndpoints: {} },
      {
        publishableKey: 'pk_snd_123',
        customEndpoints: { overrideEndpoints: undefined },
      },
      {
        publishableKey: 'pk_snd_123',
        customEndpoints: { overrideEndpoints: null },
      },
      { publishableKey: 'pk_snd_123', customEndpoints: { commonEndpoint: 42 } },
      {
        publishableKey: 'pk_snd_123',
        customEndpoints: 'https://proxy.merchant.test',
      },
      { publishableKey: 'pk_snd_123', environment: 'production' },
    ];
    for (const hyper of shapes) {
      expect(() => createTelemetry().configure(hyper as never)).not.toThrow();
    }

    const configs = loggerCalls().map((call) =>
      call.method === 'configure' ? call.config : undefined
    );
    /* The six with a usable key configure; malformed endpoint parts read as absent. */
    expect(configs.map((config) => config?.customEndpoints)).toEqual([
      {},
      {},
      {},
      {},
      undefined,
      undefined,
    ]);
    expect(configs.map((config) => config?.environment)).toEqual([
      'PROD',
      'PROD',
      'PROD',
      'PROD',
      'PROD',
      'PROD',
    ]);
  });

  it('gives every session its own id', () => {
    expect(createTelemetry().sessionId).not.toBe(createTelemetry().sessionId);
  });

  it('logs INITIATED once per session, with the entry point and the session id', () => {
    const telemetry = createTelemetry();
    telemetry.initiated('HyperPaymentMethodSession', '0a_pms_0192');
    telemetry.initiated('HyperPaymentMethodSession', '0a_pms_0192');
    expect(loggedEvents()).toEqual([
      {
        eventName: 'PAYMENT_METHOD_SESSION_INITIATED',
        value:
          '{"entry":"HyperPaymentMethodSession","pmSessionId":"0a_pms_0192"}',
        logType: 'INFO',
        latency: undefined,
      },
    ]);
  });

  describe('FIELD_MOUNTED / FIELD_RENDERED', () => {
    const fieldEvents = () =>
      loggedEvents()
        .filter((e) => e.eventName.includes('_FIELD_'))
        .map((e) => [
          e.eventName.replace('PAYMENT_METHOD_SESSION_', ''),
          e.latency,
        ]);

    it("keeps the first mount through a remount before render (the SDK's own)", () => {
      const now = jest.spyOn(Date, 'now');
      const telemetry = createTelemetry();
      now.mockReturnValue(1_000);
      telemetry.fieldRendered('cardNumber');
      telemetry.fieldMounted('cardNumber');
      now.mockReturnValue(1_400);
      telemetry.fieldUnmounted('cardNumber');
      telemetry.fieldMounted('cardNumber');
      now.mockReturnValue(1_843);
      telemetry.fieldRendered('cardNumber');
      telemetry.fieldRendered('cardNumber');
      now.mockRestore();

      expect(fieldEvents()).toEqual([
        ['FIELD_MOUNTED', undefined],
        ['FIELD_RENDERED', 843],
      ]);
    });

    it('logs a fresh pair when a rendered field is unmounted and mounted again, as web does', () => {
      const now = jest.spyOn(Date, 'now');
      const telemetry = createTelemetry();
      now.mockReturnValue(1_000);
      telemetry.fieldMounted('cardCvc');
      now.mockReturnValue(1_100);
      telemetry.fieldRendered('cardCvc');
      telemetry.fieldUnmounted('cardCvc');
      now.mockReturnValue(5_000);
      telemetry.fieldMounted('cardCvc');
      now.mockReturnValue(5_030);
      telemetry.fieldRendered('cardCvc');
      now.mockRestore();

      expect(fieldEvents()).toEqual([
        ['FIELD_MOUNTED', undefined],
        ['FIELD_RENDERED', 100],
        ['FIELD_MOUNTED', undefined],
        ['FIELD_RENDERED', 30],
      ]);
    });
  });

  describe('DATA_FILLED', () => {
    const filledValues = () =>
      loggedEvents()
        .filter((e) => e.eventName === 'PAYMENT_METHOD_SESSION_DATA_FILLED')
        .map((e) => e.value);
    const all: ElementType[] = [
      'cardholderName',
      'cardCvc',
      'cardNumber',
      'cardExpiry',
    ];
    const completeExcept =
      (...incomplete: ElementType[]) =>
      (field: ElementType) =>
        !incomplete.includes(field);

    it('waits for the card fields only, then logs the name once it completes', () => {
      const telemetry = createTelemetry();
      telemetry.dataFilled([], () => true);
      telemetry.dataFilled(all, completeExcept('cardCvc', 'cardholderName'));
      telemetry.dataFilled(all, completeExcept('cardholderName'));
      telemetry.dataFilled(all, completeExcept('cardholderName'));
      telemetry.dataFilled(all, completeExcept());
      telemetry.dataFilled(all, completeExcept());
      expect(filledValues()).toEqual([
        'cardNumber,cardExpiry,cardCvc',
        'cardNumber,cardExpiry,cardCvc,cardholderName',
      ]);
    });

    it('logs once when the name is already complete', () => {
      const telemetry = createTelemetry();
      telemetry.dataFilled(all, completeExcept());
      telemetry.dataFilled(all, completeExcept());
      expect(filledValues()).toEqual([
        'cardNumber,cardExpiry,cardCvc,cardholderName',
      ]);
    });

    it('lists only the mounted card fields, e.g. the saved-card CVC', () => {
      const telemetry = createTelemetry();
      telemetry.dataFilled(['cardholderName'], () => true);
      telemetry.dataFilled(['cardCvc'], () => true);
      expect(filledValues()).toEqual(['cardCvc']);
    });
  });

  it("logs TOKENIZE_INIT, then one TOKENIZE in web's shape, with no message it cannot trust", () => {
    const telemetry = createTelemetry();
    telemetry.tokenizeInitiated('vgs');
    telemetry.tokenizeOutcome(
      {
        status: 'success',
        vaultType: 'vgs',
        data: { tokens: { card_number: 'tok_secret' } },
      },
      'vgs'
    );
    telemetry.tokenizeInitiated(undefined);
    telemetry.tokenizeOutcome(
      {
        status: 'error',
        error: {
          code: 'session_expired',
          message: 'Backend said 4242424242424242',
          type: 'api_error',
        },
      },
      undefined
    );

    expect(loggedEvents()).toEqual([
      expect.objectContaining({
        eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE_INIT',
        value: 'vgs',
      }),
      expect.objectContaining({
        eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE',
        value: '{"vaultType":"vgs"}',
        logType: 'INFO',
      }),
      expect.objectContaining({
        eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE_INIT',
        value: 'unknown',
      }),
      expect.objectContaining({
        eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE',
        value: '{"vaultType":"unknown","code":"session_expired","message":""}',
        logType: 'ERROR',
      }),
    ]);
    expect(JSON.stringify(loggerCalls())).not.toMatch(/tok_secret|4242/);
  });

  it("quotes the message only when the Hyperswitch vault's adapter vouched for it", () => {
    const telemetry = createTelemetry();
    telemetry.tokenizeOutcome(
      trustVaultMessage(
        errorResult(
          'hyperswitch',
          'tokenization_failed',
          'The vault session could not be authorized.'
        )
      ),
      'hyperswitch'
    );
    telemetry.tokenizeOutcome(
      errorResult(
        'hyperswitch',
        'unsupported_configuration',
        'Could not resolve the vault configuration: Received {"sdkAuthorization":"secret"}'
      ),
      'hyperswitch'
    );
    expect(loggedEvents().map((e) => e.value)).toEqual([
      '{"vaultType":"hyperswitch","code":"tokenization_failed","message":"The vault session could not be authorized."}',
      '{"vaultType":"hyperswitch","code":"unsupported_configuration","message":""}',
    ]);
  });

  it('never throws on a malformed result, and names only known vault types and codes', () => {
    const telemetry = createTelemetry();
    expect(() =>
      telemetry.tokenizeOutcome({ status: 'error' } as never, 'vgs')
    ).not.toThrow();
    expect(() =>
      telemetry.tokenizeOutcome(undefined as never, undefined)
    ).not.toThrow();
    telemetry.tokenizeInitiated('my_vault' as never);
    telemetry.tokenizeOutcome(
      {
        status: 'error',
        vaultType: 'my_vault',
        error: { code: 'declined 4242 4242 4242 4242', message: 'x' },
      } as never,
      undefined
    );

    expect(loggedEvents().map((e) => [e.eventName, e.value])).toEqual([
      [
        'PAYMENT_METHOD_SESSION_TOKENIZE',
        '{"vaultType":"vgs","code":"tokenization_failed","message":""}',
      ],
      [
        'PAYMENT_METHOD_SESSION_TOKENIZE',
        '{"vaultType":"unknown","code":"tokenization_failed","message":""}',
      ],
      ['PAYMENT_METHOD_SESSION_TOKENIZE_INIT', 'unknown'],
      [
        'PAYMENT_METHOD_SESSION_TOKENIZE',
        '{"vaultType":"unknown","code":"tokenization_failed","message":""}',
      ],
    ]);
  });

  it('reads the payment-method-session id from either authorization', () => {
    const auth = Buffer.from(
      'publishable_key=pk_x,payment_method_session_id=0a_pms_0192'
    ).toString('base64');
    expect(paymentMethodSessionIdOf(auth, undefined)).toBe('0a_pms_0192');
    expect(
      paymentMethodSessionIdOf(undefined, {
        vaultType: 'hyperswitch',
        vaultData: { sdkAuthorization: auth },
      })
    ).toBe('0a_pms_0192');
    expect(
      paymentMethodSessionIdOf(undefined, {
        vaultType: 'vgs',
        vaultData: { sdkAuthorization: auth },
      })
    ).toBe('');
    expect(paymentMethodSessionIdOf('%%%', undefined)).toBe('');
  });

  describe('retrieve call', () => {
    const url =
      'https://app.hyperswitch.io/api/v1/payment-method-sessions/0a_pms_0192';

    it('logs the request, then a 2xx response without its body', () => {
      const { retrieveCall } = createTelemetry();
      const startedAt = retrieveCall.request(url);
      retrieveCall.response(url, startedAt, 200, {
        vault_details: { vault_data: { sdk_authorization: 'secret' } },
      });

      expect(loggedEvents()).toEqual([
        expect.objectContaining({
          eventName: 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT',
          apiLogType: 'Request',
          url,
        }),
        expect.objectContaining({
          eventName: 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
          apiLogType: 'Response',
          statusCode: '200',
          data: undefined,
        }),
      ]);
      expect(JSON.stringify(loggerCalls())).not.toContain('secret');
    });

    it('keeps only the type and code of a non-2xx body, never its message', () => {
      const { retrieveCall } = createTelemetry();
      retrieveCall.response(url, retrieveCall.request(url), 404, {
        error: {
          type: 'invalid_request',
          code: 'HE_02',
          message: 'Payment method session does not exist',
          extra: { sdk_authorization: 'secret' },
        },
      });

      expect(loggedEvents()[1]).toEqual(
        expect.objectContaining({
          apiLogType: 'Err',
          statusCode: '404',
          data: { error: { type: 'invalid_request', code: 'HE_02' } },
        })
      );
      expect(JSON.stringify(loggerCalls())).not.toContain('does not exist');
    });

    it('logs a request that got no response as 504 with a fixed reason', () => {
      const { retrieveCall } = createTelemetry();
      retrieveCall.failure(url, retrieveCall.request(url), 'timeout');
      expect(loggedEvents()[1]).toEqual(
        expect.objectContaining({
          eventName: 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
          apiLogType: 'NoResponse',
          statusCode: '504',
          data: { error: 'timeout' },
        })
      );
    });
  });

  it('logs the VGS submit status, as ERROR when it is not 2xx or there was none', () => {
    const { adapter } = createTelemetry();
    adapter.vgsSubmitStatus(200);
    adapter.vgsSubmitStatus(422);
    adapter.vgsSubmitStatus(null);
    expect(loggedEvents()).toEqual([
      expect.objectContaining({
        eventName: 'VGS_VAULT_FLOW',
        value: 'VGS submit status: 200',
        logType: 'INFO',
      }),
      expect.objectContaining({
        eventName: 'VGS_VAULT_FLOW',
        value: 'VGS submit status: 422',
        logType: 'ERROR',
      }),
      expect.objectContaining({
        eventName: 'VGS_VAULT_FLOW',
        value: 'VGS submit status: null',
        logType: 'ERROR',
      }),
    ]);
  });

  it('forwards crashes to the logger', () => {
    const error = new Error('boom');
    createTelemetry().crash(error);
    expect(loggerCalls()).toEqual([{ method: 'logCrash', error }]);
  });
});

describe('sanitizeVaultEvent', () => {
  const url =
    'https://app.hyperswitch.io/api/v1/payment-method-sessions/0a_pms_0192/confirm';

  it("accepts only the vault's own call events", () => {
    expect(
      sanitizeVaultEvent({
        eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE',
        apiLogType: 'Response',
        url,
        statusCode: '200',
      })
    ).toBeUndefined();
    expect(sanitizeVaultEvent('nope')).toBeUndefined();
    expect(
      sanitizeVaultEvent({
        eventName: 'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
        apiLogType: 'Bogus',
        url,
        statusCode: '200',
      })
    ).toBeUndefined();
  });

  it('rebuilds events field by field, dropping anything extra', () => {
    expect(
      sanitizeVaultEvent({
        eventName: 'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
        apiLogType: 'Response',
        url,
        statusCode: '200',
        latency: 120,
        data: { payment_method_token: 'tok_secret' },
        card_number: '4242424242424242',
      })
    ).toEqual({
      eventName: 'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
      apiLogType: 'Response',
      url,
      statusCode: '200',
      latency: 120,
    });
  });

  it('re-trims an error body and normalises an unknown failure reason', () => {
    expect(
      sanitizeVaultEvent({
        eventName: 'PAYMENT_METHOD_SESSION_UPDATE_CALL',
        apiLogType: 'Err',
        url,
        statusCode: '422',
        data: { error: { code: 'IR_05', message: 'x', card: '4242' } },
      })?.data
    ).toEqual({ error: { code: 'IR_05' } });
    expect(
      sanitizeVaultEvent({
        eventName: 'PAYMENT_METHOD_SESSION_UPDATE_CALL',
        apiLogType: 'NoResponse',
        url,
        statusCode: '504',
        data: { error: 'TypeError: Network request failed at 4242...' },
      })?.data
    ).toEqual({ error: 'network_error' });
  });
});
