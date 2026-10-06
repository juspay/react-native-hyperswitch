import { Component, createRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Text } from 'react-native';
import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';
import { render, screen, act, waitFor } from '@testing-library/react-native';

/* The Hyperswitch vault is an optional peer; stand one in to read what the adapter hands it. */
const vaultForm: { props?: Record<string, any> } = {};
jest.mock(
  '@juspay-tech/react-native-hyperswitch-vault',
  () => {
    const {
      Fragment,
      createElement,
      forwardRef,
      useImperativeHandle,
    } = require('react');
    const { Text: RNText } = require('react-native');
    const field = (elementType: string) => () =>
      createElement(RNText, { testID: `vault-${elementType}` }, elementType);
    return {
      CardForm: forwardRef(
        ({ children, ...rest }: Record<string, any>, ref: unknown) => {
          vaultForm.props = rest;
          useImperativeHandle(ref, () => ({ tokenize: async () => ({}) }), []);
          return createElement(Fragment, null, children);
        }
      ),
      CardNumberField: field('cardNumber'),
      CardExpiryField: field('cardExpiry'),
      CardCVCField: field('cardCvc'),
      CardholderNameField: field('cardholderName'),
    };
  },
  { virtual: true }
);

import { HyperPaymentMethodSession } from '../../session/HyperPaymentMethodSession';
import { initPaymentMethodSession } from '../../session/paymentMethodSession';
import { CardForm } from '../../core/CardForm';
import { registerAdapter } from '../../providers/registry';
import { hyperswitchVaultAdapter } from '../../providers/hyperswitch/adapter';
import { CardNumberField, CardExpiryField, CardCVCField } from '../../fields';
import { createMockAdapter } from '../../__fixtures__/mockAdapter';
import type { MockAdapterOptions } from '../../__fixtures__/mockAdapter';
import {
  eventNames,
  loggedEvents,
  loggerCalls,
  resetLoggerCalls,
} from '../../__fixtures__/loggerRecorder';
import type { HyperswitchConfiguration } from '../../session/config';
import type { CardFormHandle, TokenizeResult } from '../../core/types';

const VALID_AUTH = Buffer.from(
  'publishable_key=pk_snd_123,client_secret=pms_secret_abc,payment_method_session_id=0a_pms_0192',
  'utf8'
).toString('base64');

const RETRIEVE_URL =
  'https://app.hyperswitch.io/api/v1/payment-method-sessions/0a_pms_0192';

const vgsSession = {
  id: '0a_pms_0192',
  external_vault_details: {
    vgs: { external_vault_id: 'tnt_abc', sdk_env: 'sandbox' },
  },
};

const hyper: HyperswitchConfiguration = {
  publishableKey: 'pk_snd_123',
  environment: 'SANDBOX',
};

const complete = { empty: false, valid: true, touched: true };

const cleanups: Array<() => void> = [];
const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock<(...args: unknown[]) => Promise<unknown>>;

beforeEach(() => {
  resetLoggerCalls();
  fetchMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
});

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  (globalThis as { fetch?: unknown }).fetch = originalFetch;
});

function installMock(options: MockAdapterOptions = {}) {
  cleanups.push(registerAdapter(createMockAdapter(options)));
}

async function tokenizeVia(ref: RefObject<CardFormHandle | null>) {
  let result: TokenizeResult | undefined;
  await act(async () => {
    result = await ref.current!.tokenize();
  });
  return result;
}

const count = (name: string) =>
  eventNames().filter((eventName) => eventName === name).length;

function Form({ formRef }: { formRef: RefObject<CardFormHandle | null> }) {
  return (
    <CardForm ref={formRef}>
      <CardNumberField />
      <CardExpiryField />
      <CardCVCField />
    </CardForm>
  );
}

describe('<HyperPaymentMethodSession> logging', () => {
  it('logs the whole flow under one session, in order', async () => {
    installMock({ vaultType: 'vgs', fieldState: complete });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => vgsSession,
    });
    const ref = createRef<CardFormHandle>();

    render(
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{ sdkAuthorization: VALID_AUTH }}
      >
        <Form formRef={ref} />
      </HyperPaymentMethodSession>
    );

    await waitFor(() =>
      expect(count('PAYMENT_METHOD_SESSION_FIELD_RENDERED')).toBe(3)
    );
    await waitFor(() =>
      expect(count('PAYMENT_METHOD_SESSION_DATA_FILLED')).toBe(1)
    );
    await tokenizeVia(ref);
    await tokenizeVia(ref);

    const events = loggedEvents();
    expect(events[0]).toEqual(
      expect.objectContaining({
        eventName: 'PAYMENT_METHOD_SESSION_INITIATED',
        value:
          '{"entry":"HyperPaymentMethodSession","pmSessionId":"0a_pms_0192"}',
      })
    );
    expect(events.filter((e) => e.eventName.includes('RETRIEVE'))).toEqual([
      expect.objectContaining({
        eventName: 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT',
        apiLogType: 'Request',
        url: RETRIEVE_URL,
      }),
      expect.objectContaining({
        eventName: 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
        apiLogType: 'Response',
        statusCode: '200',
        data: undefined,
      }),
    ]);
    expect(
      events
        .filter((e) => e.eventName === 'PAYMENT_METHOD_SESSION_FIELD_MOUNTED')
        .map((e) => e.value)
    ).toEqual(['cardNumber', 'cardExpiry', 'cardCvc']);
    for (const rendered of events.filter(
      (e) => e.eventName === 'PAYMENT_METHOD_SESSION_FIELD_RENDERED'
    )) {
      expect(rendered.latency).toBeGreaterThanOrEqual(0);
    }
    expect(
      events.find((e) => e.eventName === 'PAYMENT_METHOD_SESSION_DATA_FILLED')
        ?.value
    ).toBe('cardNumber,cardExpiry,cardCvc');
    expect(
      events
        .filter((e) => e.eventName.includes('TOKENIZE'))
        .map((e) => [e.eventName, e.value])
    ).toEqual([
      ['PAYMENT_METHOD_SESSION_TOKENIZE_INIT', 'vgs'],
      ['PAYMENT_METHOD_SESSION_TOKENIZE', '{"vaultType":"vgs"}'],
      ['PAYMENT_METHOD_SESSION_TOKENIZE_INIT', 'vgs'],
      ['PAYMENT_METHOD_SESSION_TOKENIZE', '{"vaultType":"vgs"}'],
    ]);

    const configured = loggerCalls().filter((c) => c.method === 'configure');
    expect(configured).toHaveLength(1);
    expect(configured[0]).toEqual({
      method: 'configure',
      config: expect.objectContaining({
        publishableKey: 'pk_snd_123',
        environment: 'SANDBOX',
        source: 'PAYMENT_METHODS_SDK',
      }),
    });

    /* Only the lookup itself went over the network; logs go through the logger. */
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(loggerCalls())).not.toMatch(
      /pms_secret_abc|tnt_abc|card_number|tok_mock/
    );
    expect(JSON.stringify(loggerCalls())).not.toContain(VALID_AUTH);
  });

  it("logs a failed tokenize with the code but not a provider's message", async () => {
    installMock({
      vaultType: 'vgs',
      tokenizeResult: {
        status: 'error',
        vaultType: 'vgs',
        error: {
          code: 'tokenization_failed',
          message: 'VGS returned status 500 for 4242 4242 4242 4242.',
          type: 'api_error',
        },
      },
    });
    const ref = createRef<CardFormHandle>();

    render(
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{ vaultDetails: { vaultType: 'vgs', vaultData: {} } }}
      >
        <Form formRef={ref} />
      </HyperPaymentMethodSession>
    );
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardNumber')).toBeTruthy()
    );
    await tokenizeVia(ref);

    expect(
      loggedEvents().find(
        (e) => e.eventName === 'PAYMENT_METHOD_SESSION_TOKENIZE'
      )
    ).toEqual(
      expect.objectContaining({
        value: '{"vaultType":"vgs","code":"tokenization_failed","message":""}',
        logType: 'ERROR',
      })
    );
    expect(JSON.stringify(loggerCalls())).not.toContain('4242');
  });

  it("hands a custom adapter's malformed result back instead of rejecting", async () => {
    /* registerAdapter is public: a plain-JS adapter can return an error with no error object. */
    installMock({
      vaultType: 'vgs',
      tokenizeResult: { status: 'error' } as never,
    });
    const ref = createRef<CardFormHandle>();

    render(
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{ vaultDetails: { vaultType: 'vgs', vaultData: {} } }}
      >
        <Form formRef={ref} />
      </HyperPaymentMethodSession>
    );
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardNumber')).toBeTruthy()
    );

    await expect(tokenizeVia(ref)).resolves.toEqual({ status: 'error' });
    expect(
      loggedEvents().find(
        (e) => e.eventName === 'PAYMENT_METHOD_SESSION_TOKENIZE'
      )
    ).toEqual(
      expect.objectContaining({
        value: '{"vaultType":"vgs","code":"tokenization_failed","message":""}',
        logType: 'ERROR',
      })
    );
  });

  it('logs a 4xx lookup with only the error type and code', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          type: 'invalid_request',
          code: 'IR_01',
          message: 'API key not provided or invalid API key used',
          reason: VALID_AUTH,
        },
      }),
    });

    render(
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{ sdkAuthorization: VALID_AUTH }}
      >
        <Text>child</Text>
      </HyperPaymentMethodSession>
    );

    await waitFor(() =>
      expect(count('PAYMENT_METHOD_SESSION_RETRIEVE_CALL')).toBe(1)
    );
    expect(
      loggedEvents().find(
        (e) => e.eventName === 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL'
      )
    ).toEqual(
      expect.objectContaining({
        apiLogType: 'Err',
        statusCode: '401',
        data: { error: { type: 'invalid_request', code: 'IR_01' } },
      })
    );
  });

  it('logs a lookup that gets no response as 504', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    render(
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{ sdkAuthorization: VALID_AUTH }}
      >
        <Text>child</Text>
      </HyperPaymentMethodSession>
    );

    await waitFor(() =>
      expect(count('PAYMENT_METHOD_SESSION_RETRIEVE_CALL')).toBe(1)
    );
    expect(
      loggedEvents().find(
        (e) => e.eventName === 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL'
      )
    ).toEqual(
      expect.objectContaining({
        apiLogType: 'NoResponse',
        statusCode: '504',
        data: { error: 'network_error' },
      })
    );
  });

  it('queues events until a promised hyper resolves', async () => {
    installMock({ vaultType: 'vgs' });
    let resolveHyper!: (value: HyperswitchConfiguration) => void;
    const pending = new Promise<HyperswitchConfiguration>((resolve) => {
      resolveHyper = resolve;
    });

    render(
      <HyperPaymentMethodSession
        hyper={pending}
        options={{ vaultDetails: { vaultType: 'vgs', vaultData: {} } }}
      >
        <CardForm>
          <CardNumberField />
        </CardForm>
      </HyperPaymentMethodSession>
    );

    await waitFor(() =>
      expect(count('PAYMENT_METHOD_SESSION_FIELD_MOUNTED')).toBe(1)
    );
    expect(loggerCalls().some((c) => c.method === 'configure')).toBe(false);

    await act(async () => resolveHyper(hyper));
    expect(loggerCalls().filter((c) => c.method === 'configure')).toHaveLength(
      1
    );
  });

  it('reports a crash inside a field, then rethrows it to the app', async () => {
    const adapter = createMockAdapter({ vaultType: 'vgs' });
    cleanups.push(
      registerAdapter({
        ...adapter,
        Field: () => {
          throw new Error('field exploded');
        },
      })
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});

    class AppBoundary extends Component<
      { children: ReactNode },
      { caught: string | null }
    > {
      state = { caught: null as string | null };
      static getDerivedStateFromError(error: Error) {
        return { caught: error.message };
      }
      render() {
        return this.state.caught ? (
          <Text testID="app-fallback">{this.state.caught}</Text>
        ) : (
          this.props.children
        );
      }
    }

    render(
      <AppBoundary>
        <HyperPaymentMethodSession
          hyper={hyper}
          options={{ vaultDetails: { vaultType: 'vgs', vaultData: {} } }}
        >
          <CardForm>
            <CardNumberField />
          </CardForm>
        </HyperPaymentMethodSession>
      </AppBoundary>
    );

    await waitFor(() =>
      expect(screen.getByTestId('app-fallback').props.children).toBe(
        'field exploded'
      )
    );
    const crashes = loggerCalls().filter((c) => c.method === 'logCrash');
    expect(crashes).toHaveLength(1);
    expect((crashes[0] as { error: Error }).error.message).toBe(
      'field exploded'
    );
  });
});

describe('remounting a field', () => {
  it('logs a fresh MOUNTED / RENDERED pair when the merchant mounts a rendered field again', async () => {
    installMock({ vaultType: 'vgs' });
    const session = (showNumber: boolean) => (
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{ vaultDetails: { vaultType: 'vgs', vaultData: {} } }}
      >
        <CardForm>
          {showNumber ? <CardNumberField /> : null}
          <CardCVCField />
        </CardForm>
      </HyperPaymentMethodSession>
    );

    const view = render(session(true));
    await waitFor(() =>
      expect(count('PAYMENT_METHOD_SESSION_FIELD_RENDERED')).toBe(2)
    );
    view.rerender(session(false));
    view.rerender(session(true));
    await waitFor(() =>
      expect(count('PAYMENT_METHOD_SESSION_FIELD_RENDERED')).toBe(3)
    );

    const fieldEvents = loggedEvents()
      .filter((e) => e.eventName.includes('_FIELD_'))
      .map(
        (e) =>
          `${e.eventName.replace('PAYMENT_METHOD_SESSION_', '')}:${e.value}`
      );
    expect(fieldEvents.filter((e) => e.endsWith(':cardNumber'))).toEqual([
      'FIELD_MOUNTED:cardNumber',
      'FIELD_RENDERED:cardNumber',
      'FIELD_MOUNTED:cardNumber',
      'FIELD_RENDERED:cardNumber',
    ]);
    expect(fieldEvents.filter((e) => e.endsWith(':cardCvc'))).toEqual([
      'FIELD_MOUNTED:cardCvc',
      'FIELD_RENDERED:cardCvc',
    ]);
  });
});

describe('<CardForm> outside a session', () => {
  it('logs nothing, leaving the vault to log on its own', async () => {
    installMock({ vaultType: 'vgs', fieldState: complete });
    const ref = createRef<CardFormHandle>();

    render(
      <CardForm ref={ref} vaultDetails={{ vaultType: 'vgs', vaultData: {} }}>
        <CardNumberField />
      </CardForm>
    );
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardNumber')).toBeTruthy()
    );
    await tokenizeVia(ref);

    expect(loggerCalls()).toEqual([]);
  });
});

describe('initPaymentMethodSession logging', () => {
  it('logs the session, the lookup, the detached fields and tokenize', async () => {
    installMock({ vaultType: 'vgs', fieldState: complete });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => vgsSession,
    });

    const session = await initPaymentMethodSession(hyper, {
      sdkAuthorization: VALID_AUTH,
    });
    const cardForm = session.createCardForm();
    render(
      <>
        <CardNumberField form={cardForm} />
        <CardExpiryField form={cardForm} />
        <CardCVCField form={cardForm} />
      </>
    );
    await waitFor(() =>
      expect(count('PAYMENT_METHOD_SESSION_DATA_FILLED')).toBe(1)
    );
    await act(async () => {
      await cardForm.tokenize();
    });

    expect(eventNames().slice(0, 3)).toEqual([
      'PAYMENT_METHOD_SESSION_INITIATED',
      'PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT',
      'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
    ]);
    expect(loggedEvents()[0]?.value).toBe(
      '{"entry":"initPaymentMethodSession","pmSessionId":"0a_pms_0192"}'
    );
    expect(count('PAYMENT_METHOD_SESSION_FIELD_MOUNTED')).toBe(3);
    expect(count('PAYMENT_METHOD_SESSION_TOKENIZE')).toBe(1);
  });
});

describe('customEndpoints from a JavaScript caller', () => {
  /* `{}` and `{ overrideEndpoints: undefined }` come from conditional configs. Configuring the
     logger with them once threw: from a useEffect, and out of initPaymentMethodSession. */
  const shapes = [
    {},
    { overrideEndpoints: undefined },
    { overrideEndpoints: null },
  ];

  it('never break <HyperPaymentMethodSession>', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => vgsSession,
    });
    for (const customEndpoints of shapes) {
      resetLoggerCalls();
      const view = render(
        <HyperPaymentMethodSession
          hyper={{ ...hyper, customEndpoints } as never}
          options={{ sdkAuthorization: VALID_AUTH }}
        >
          <Text>child</Text>
        </HyperPaymentMethodSession>
      );
      await waitFor(() =>
        expect(loggerCalls().some((call) => call.method === 'configure')).toBe(
          true
        )
      );
      expect(screen.getByText('child')).toBeTruthy();
      view.unmount();
    }
  });

  it('never make initPaymentMethodSession reject', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => vgsSession,
    });
    for (const customEndpoints of shapes) {
      await expect(
        initPaymentMethodSession({ ...hyper, customEndpoints } as never, {
          sdkAuthorization: VALID_AUTH,
        })
      ).resolves.toBeDefined();
    }
  });
});

describe('Hyperswitch vault inside a session', () => {
  it("hands the vault this session's sink, which takes only the vault's call events", async () => {
    cleanups.push(registerAdapter(hyperswitchVaultAdapter));

    render(
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{
          vaultDetails: {
            vaultType: 'hyperswitch',
            vaultData: { sdkAuthorization: VALID_AUTH },
          },
        }}
      >
        <CardForm>
          <CardNumberField />
        </CardForm>
      </HyperPaymentMethodSession>
    );
    await waitFor(() => expect(vaultForm.props?.logSink).toBeDefined());

    resetLoggerCalls();
    const sink = vaultForm.props!.logSink as (event: unknown) => void;
    sink({
      eventName: 'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
      apiLogType: 'Response',
      url: `${RETRIEVE_URL}/confirm`,
      statusCode: '200',
      data: { payment_method_token: 'tok_secret' },
    });
    sink({
      eventName: 'PAYMENT_METHOD_SESSION_TOKENIZE',
      apiLogType: 'Response',
      url: 'x',
      statusCode: '200',
    });

    expect(loggedEvents()).toEqual([
      expect.objectContaining({
        eventName: 'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
        apiLogType: 'Response',
        data: undefined,
      }),
    ]);
  });

  it("quotes the vault's own failure message, as web does for this vault", async () => {
    cleanups.push(registerAdapter(hyperswitchVaultAdapter));
    const ref = createRef<CardFormHandle>();

    render(
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{
          vaultDetails: {
            vaultType: 'hyperswitch',
            vaultData: { sdkAuthorization: VALID_AUTH },
          },
        }}
      >
        <CardForm ref={ref}>
          <CardNumberField />
        </CardForm>
      </HyperPaymentMethodSession>
    );
    await waitFor(() => expect(vaultForm.props?.logSink).toBeDefined());
    /* The stand-in vault's tokenize() answers {}, which the adapter reports as a failure. */
    await tokenizeVia(ref);

    expect(
      loggedEvents().find(
        (e) => e.eventName === 'PAYMENT_METHOD_SESSION_TOKENIZE'
      )
    ).toEqual(
      expect.objectContaining({
        value:
          '{"vaultType":"hyperswitch","code":"tokenization_failed","message":"The card could not be tokenized."}',
        logType: 'ERROR',
      })
    );
  });

  it('gives a vault outside a session no sink, so it logs on its own', async () => {
    vaultForm.props = undefined;
    cleanups.push(registerAdapter(hyperswitchVaultAdapter));

    render(
      <CardForm
        vaultDetails={{
          vaultType: 'hyperswitch',
          vaultData: { sdkAuthorization: VALID_AUTH },
        }}
      >
        <CardNumberField />
      </CardForm>
    );
    await waitFor(() => expect(vaultForm.props).toBeDefined());
    const props = vaultForm.props as Record<string, unknown> | undefined;
    expect(props?.logSink).toBeUndefined();
  });
});
