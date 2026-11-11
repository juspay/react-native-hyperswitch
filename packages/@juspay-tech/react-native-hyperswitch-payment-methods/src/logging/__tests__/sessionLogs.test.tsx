import { Component, createRef } from 'react';
import type { ReactNode } from 'react';
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

import { HyperPaymentMethodSession } from '../../session/HyperPaymentMethodSession';
import { initPaymentMethodSession } from '../../session/paymentMethodSession';
import { CardForm } from '../../core/CardForm';
import { registerAdapter } from '../../providers/registry';
import { CardNumberField, CardExpiryField, CardCVCField } from '../../fields';
import { createMockAdapter } from '../../__fixtures__/mockAdapter';
import type { MockAdapterOptions } from '../../__fixtures__/mockAdapter';
import type { HyperswitchConfiguration } from '../../session/init';
import type { ProviderAdapter } from '../../core/ProviderAdapter';
import type { CardFormHandle, TokenizeResult } from '../../core/types';
import { createLogger, sendQueuedLogs, setLogTransport } from '../logger';
import { fetchVaultDetails } from '../../session/fetchVaultDetails';

const AUTH = Buffer.from(
  'publishable_key=pk_snd_flow,payment_method_session_id=0a_pms_flow,profile_id=pro_flow',
  'utf8'
).toString('base64');

const SANDBOX: HyperswitchConfiguration = {
  publishableKey: 'pk_snd_flow',
  environment: 'SANDBOX',
};

const vgsSession = {
  id: '0a_pms_flow',
  external_vault_details: {
    vgs: { external_vault_id: 'tnt_flow', sdk_env: 'sandbox' },
  },
};

const LOOKUP_URL =
  'https://app.hyperswitch.io/api/v1/payment-method-sessions/0a_pms_flow';

let batches: Array<Array<Record<string, string>>>;
let urls: string[];
const cleanups: Array<() => void> = [];
const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock<(...args: unknown[]) => Promise<unknown>>;

beforeEach(() => {
  batches = [];
  urls = [];
  setLogTransport((url, body) => {
    urls.push(url);
    batches.push(JSON.parse(body));
  });
  fetchMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
});

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  setLogTransport(() => {});
  (globalThis as { fetch?: unknown }).fetch = originalFetch;
});

const logs = () => batches.flat();
const events = () => logs().map((log) => log.event_name);

function install(adapter: ProviderAdapter) {
  cleanups.push(registerAdapter(adapter));
  return adapter;
}

const installMock = (options: MockAdapterOptions = {}) =>
  install(createMockAdapter(options));

const answer = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

async function tokenizeVia(ref: { current: CardFormHandle | null }) {
  let result: TokenizeResult | undefined;
  await act(async () => {
    result = await ref.current!.tokenize();
  });
  return result;
}

function renderSession(
  options: Record<string, unknown>,
  hyper: HyperswitchConfiguration = SANDBOX,
  ref = createRef<CardFormHandle>()
) {
  const view = render(
    <HyperPaymentMethodSession hyper={hyper} options={options as never}>
      <CardForm ref={ref}>
        <CardNumberField />
        <CardExpiryField />
        <CardCVCField />
      </CardForm>
    </HyperPaymentMethodSession>
  );
  return { view, ref };
}

describe('a payment-method session', () => {
  it('logs the whole flow under the session’s merchant and payment-method session', async () => {
    installMock({
      vaultType: 'vgs',
      fieldState: { empty: false, valid: true, touched: true },
    });
    answer(200, vgsSession);

    const { view, ref } = renderSession({ sdkAuthorization: AUTH });
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardCvc')).toBeTruthy()
    );
    expect((await tokenizeVia(ref))?.status).toBe('success');
    view.unmount();
    await Promise.resolve();

    /* The close sends the fields' unmounts with it, no timer needed. */
    expect(batches.at(-1)!.map((log) => log.value)).toEqual([
      'cardNumber unmounted',
      'cardExpiry unmounted',
      'cardCvc unmounted',
      'Card form deinitialized',
    ]);
    /* Each field is mounted once, though React moves it under the provider when the vault
       arrives. */
    expect(
      logs()
        .filter(
          (log) => log.event_name === 'PAYMENT_METHOD_SESSION_FIELD_MOUNTED'
        )
        .map((log) => log.value)
    ).toEqual(['cardNumber', 'cardExpiry', 'cardCvc']);

    expect(events()).toEqual(
      expect.arrayContaining([
        'PAYMENT_METHOD_SESSION_INITIATED',
        'PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT',
        'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
        'CARD_FORM_FLOW',
        'PAYMENT_METHOD_SESSION_FIELD_MOUNTED',
        'PAYMENT_METHOD_SESSION_FIELD_RENDERED',
        'VGS_VAULT_FLOW',
        'PAYMENT_METHOD_SESSION_DATA_FILLED',
        'PAYMENT_METHOD_SESSION_TOKENIZE_INIT',
        'PAYMENT_METHOD_SESSION_TOKENIZE',
      ])
    );
    const value = (event: string) =>
      logs().find((log) => log.event_name === event)?.value;
    expect(JSON.parse(value('PAYMENT_METHOD_SESSION_INITIATED')!)).toEqual({
      entry: 'HyperPaymentMethodSession',
      pmSessionId: '0a_pms_flow',
    });
    expect(JSON.parse(value('PAYMENT_METHOD_SESSION_RETRIEVE_CALL')!)).toEqual({
      url: LOOKUP_URL,
      statusCode: 200,
    });
    expect(value('PAYMENT_METHOD_SESSION_DATA_FILLED')).toBe(
      'cardNumber,cardExpiry,cardCvc'
    );
    expect(
      logs()
        .filter((log) => log.event_name === 'CARD_FORM_FLOW')
        .map((log) => log.value)
    ).toEqual([
      'Card form created',
      'cardNumber unmounted',
      'cardExpiry unmounted',
      'cardCvc unmounted',
      'Card form deinitialized',
    ]);

    expect(new Set(urls)).toEqual(
      new Set(['https://app.hyperswitch.io/api/logs/sdk'])
    );
    expect(new Set(logs().map((log) => log.payment_id))).toEqual(
      new Set(['0a_pms_flow'])
    );
    expect(new Set(logs().map((log) => log.merchant_id))).toEqual(
      new Set(['pk_snd_flow'])
    );
    expect(new Set(logs().map((log) => log.session_id)).size).toBe(1);
    /* Only the logs went out besides the lookup. */
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const sent = JSON.stringify(batches);
    expect(sent).not.toContain(AUTH);
    expect(sent).not.toMatch(/tok_mock|pro_flow|tnt_flow/);
  });

  it('keeps the session and the form first when the instance arrives after the fields are ready', async () => {
    installMock({ vaultType: 'vgs' });
    let resolveHyper: (instance: HyperswitchConfiguration) => void = () => {};
    const hyper = new Promise<HyperswitchConfiguration>((resolve) => {
      resolveHyper = resolve;
    });
    const view = render(
      <HyperPaymentMethodSession
        hyper={hyper}
        options={{
          sdkAuthorization: AUTH,
          vaultDetails: { vaultType: 'vgs', vaultData: {} },
        }}
      >
        <CardForm>
          <CardNumberField />
        </CardForm>
      </HyperPaymentMethodSession>
    );
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardNumber')).toBeTruthy()
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    await act(async () => resolveHyper(SANDBOX));
    view.unmount();
    await Promise.resolve();

    expect(events().slice(0, 4)).toEqual([
      'PAYMENT_METHOD_SESSION_INITIATED',
      'CARD_FORM_FLOW',
      'PAYMENT_METHOD_SESSION_FIELD_MOUNTED',
      'PAYMENT_METHOD_SESSION_FIELD_RENDERED',
    ]);
    const rendered = logs().find(
      (log) => log.event_name === 'PAYMENT_METHOD_SESSION_FIELD_RENDERED'
    )!;
    expect(Number(rendered.latency)).toBeGreaterThanOrEqual(25);
  });

  it('logs the parameter it lacks, never its value', async () => {
    installMock();
    const garbled = 'not*base64!';
    const { view } = renderSession({ sdkAuthorization: garbled });
    await waitFor(() => expect(events()).toContain('INVALID_FORMAT'));
    view.unmount();

    const refusal = logs().find((log) => log.event_name === 'INVALID_FORMAT')!;
    expect(refusal).toMatchObject({
      log_type: 'ERROR',
      category: 'USER_ERROR',
      value: 'sdkAuthorization is not valid base64.',
      merchant_id: 'pk_snd_flow',
    });
    expect(JSON.stringify(batches)).not.toContain(garbled);
    expect(fetchMock).not.toHaveBeenCalled();

    batches = [];
    const empty = renderSession({});
    await waitFor(() => expect(events()).toContain('REQUIRED_PARAMETER'));
    empty.view.unmount();
    expect(
      logs().find((log) => log.event_name === 'REQUIRED_PARAMETER')!.value
    ).toMatch(/sdkAuthorization is a required field/);

    /* vaultDetails alone is a session: nothing is missing. */
    batches = [];
    const details = renderSession({
      sdkAuthorization: '',
      vaultDetails: { vaultType: 'vgs', vaultData: {} },
    });
    await waitFor(() =>
      expect(events()).toContain('PAYMENT_METHOD_SESSION_INITIATED')
    );
    details.view.unmount();
    expect(events()).not.toContain('REQUIRED_PARAMETER');
  });

  it('logs a failed lookup with its status and error body, and the form that never became ready', async () => {
    installMock();
    answer(401, {
      error: {
        type: 'invalid_request',
        code: 'IR_01',
        message: 'Unauthorized',
      },
    });

    const { view } = renderSession({ sdkAuthorization: AUTH });
    await waitFor(() =>
      expect(
        logs().some(
          (log) =>
            log.event_name === 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL' &&
            log.log_type === 'ERROR'
        )
      ).toBe(true)
    );
    view.unmount();

    const failed = logs().find(
      (log) => log.event_name === 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL'
    )!;
    expect(JSON.parse(failed.value!)).toEqual({
      url: LOOKUP_URL,
      statusCode: 401,
      response: {
        error: {
          type: 'invalid_request',
          code: 'IR_01',
          message: 'Unauthorized',
        },
      },
    });
  });

  it('sends nothing when the logging endpoint is blank', async () => {
    installMock({ fieldState: { empty: false, valid: true } });
    answer(200, vgsSession);
    const { view, ref } = renderSession(
      { sdkAuthorization: AUTH },
      {
        ...SANDBOX,
        customEndpoints: { overrideEndpoints: { customLoggingEndpoint: '' } },
      }
    );
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardCvc')).toBeTruthy()
    );
    expect((await tokenizeVia(ref))?.status).toBe('success');
    view.unmount();
    expect(batches).toEqual([]);
  });

  it('logs nothing for a form used without a session', async () => {
    installMock();
    const ref = createRef<CardFormHandle>();
    const view = render(
      <CardForm ref={ref} vaultDetails={{ vaultType: 'vgs', vaultData: {} }}>
        <CardNumberField />
      </CardForm>
    );
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardNumber')).toBeTruthy()
    );
    await tokenizeVia(ref);
    view.unmount();
    expect(batches).toEqual([]);
  });

  it('logs why a form never became usable', async () => {
    install({
      ...createMockAdapter({ vaultType: 'skyflow' }),
      validateVaultData: () => {
        throw new Error(
          'Skyflow vaultData requires vaultId. Received: {"secret":1}'
        );
      },
    });
    const { view } = renderSession({
      sdkAuthorization: AUTH,
      vaultDetails: { vaultType: 'skyflow', vaultData: { secret: 1 } },
    });
    await waitFor(() =>
      expect(logs().map((log) => log.value)).toContain(
        'Card form failed: invalid_vault_data'
      )
    );
    view.unmount();
    expect(JSON.stringify(batches)).not.toContain('secret');
  });

  it('logs a crash in a field, then throws the same error on', async () => {
    const crash = new Error('field render failed');
    const mock = createMockAdapter({ vaultType: 'vgs' });
    install({
      ...mock,
      Field: () => {
        throw crash;
      },
    });
    answer(200, vgsSession);

    const caught: unknown[] = [];
    class Outer extends Component<
      { children: ReactNode },
      { failed: boolean }
    > {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error: unknown) {
        caught.push(error);
      }
      render() {
        return this.state.failed ? <Text>outer</Text> : this.props.children;
      }
    }

    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      render(
        <Outer>
          <HyperPaymentMethodSession
            hyper={SANDBOX}
            options={{ sdkAuthorization: AUTH }}
          >
            <CardForm>
              <CardNumberField />
            </CardForm>
          </HyperPaymentMethodSession>
        </Outer>
      );
      await waitFor(() => expect(caught).toHaveLength(1));
    } finally {
      consoleError.mockRestore();
    }

    expect(caught[0]).toBe(crash);
    await waitFor(() => expect(events()).toContain('SDK_CRASH'));
    const logged = logs().filter((log) => log.event_name === 'SDK_CRASH');
    expect(logged).toHaveLength(1);
    /* Another provider's error text is not logged: only its type and the provider. */
    expect(JSON.parse(logged[0]!.value!)).toEqual({
      type: 'Error',
      vaultType: 'vgs',
      componentName: 'cardNumber',
    });
  });
});

describe('a session made with initPaymentMethodSession', () => {
  it('logs the session, its lookup and its detached form', async () => {
    installMock({
      vaultType: 'vgs',
      fieldState: { empty: false, valid: true, touched: true },
    });
    answer(200, vgsSession);

    const session = await initPaymentMethodSession(SANDBOX, {
      sdkAuthorization: AUTH,
    });
    const cardForm = session.createCardForm();
    const view = render(
      <>
        <CardNumberField form={cardForm} />
        <CardExpiryField form={cardForm} />
        <CardCVCField form={cardForm} />
      </>
    );
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardCvc')).toBeTruthy()
    );
    let result: TokenizeResult | undefined;
    await act(async () => {
      result = await cardForm.tokenize();
    });
    expect(result?.status).toBe('success');
    view.unmount();
    /* A detached form has no unmount of its own: its logs go out on the timer or when the app
       leaves the foreground. */
    sendQueuedLogs();

    expect(events()).toEqual(
      expect.arrayContaining([
        'PAYMENT_METHOD_SESSION_INITIATED',
        'PAYMENT_METHOD_SESSION_RETRIEVE_CALL',
        'PAYMENT_METHOD_SESSION_FIELD_RENDERED',
        'PAYMENT_METHOD_SESSION_DATA_FILLED',
        'PAYMENT_METHOD_SESSION_TOKENIZE',
      ])
    );
    expect(
      JSON.parse(
        logs().find(
          (log) => log.event_name === 'PAYMENT_METHOD_SESSION_INITIATED'
        )!.value!
      )
    ).toEqual({
      entry: 'initPaymentMethodSession',
      pmSessionId: '0a_pms_flow',
    });
    expect(new Set(logs().map((log) => log.payment_id))).toEqual(
      new Set(['0a_pms_flow'])
    );
    expect(JSON.stringify(batches)).not.toContain(AUTH);
  });

  it('names the session a Hyperswitch vaultDetails carries when no sdkAuthorization is passed', async () => {
    installMock({ vaultType: 'hyperswitch' });
    const hyperswitchDetails = {
      vaultType: 'hyperswitch',
      vaultData: { sdkAuthorization: AUTH },
    };
    const { view } = renderSession({ vaultDetails: hyperswitchDetails });
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardCvc')).toBeTruthy()
    );
    view.unmount();
    await initPaymentMethodSession(SANDBOX, {
      vaultDetails: hyperswitchDetails,
    } as never);
    sendQueuedLogs();

    const initiated = logs().filter(
      (log) => log.event_name === 'PAYMENT_METHOD_SESSION_INITIATED'
    );
    expect(initiated.map((log) => JSON.parse(log.value!))).toEqual([
      { entry: 'HyperPaymentMethodSession', pmSessionId: '0a_pms_flow' },
      { entry: 'initPaymentMethodSession', pmSessionId: '0a_pms_flow' },
    ]);
    expect(new Set(logs().map((log) => log.payment_id))).toEqual(
      new Set(['0a_pms_flow'])
    );
    expect(new Set(logs().map((log) => log.merchant_id))).toEqual(
      new Set(['pk_snd_flow'])
    );
    expect(JSON.stringify(batches)).not.toContain(AUTH);
  });

  it('names no session for another vault’s details passed without sdkAuthorization', async () => {
    installMock();
    const { view } = renderSession({
      vaultDetails: { vaultType: 'vgs', vaultData: {} },
    });
    await waitFor(() =>
      expect(screen.getByTestId('mock-field-cardCvc')).toBeTruthy()
    );
    view.unmount();
    expect(events()).toContain('PAYMENT_METHOD_SESSION_INITIATED');
    expect(new Set(logs().map((log) => log.payment_id))).toEqual(new Set(['']));
  });

  it('logs the parameter it lacks, and still throws as before', async () => {
    await expect(initPaymentMethodSession(SANDBOX, {})).rejects.toThrow(
      'initPaymentMethodSession needs sdkAuthorization or vaultDetails.'
    );
    expect(events()).toEqual(['REQUIRED_PARAMETER']);
  });
});

describe('the session lookup', () => {
  it('logs the error body even when the caller gives up after the answer', async () => {
    let readBody: (body: unknown) => void = () => {};
    let bodyAborted = false;
    fetchMock.mockImplementation(async (_url, init) => {
      const signal = (init as { signal: AbortSignal }).signal;
      return {
        ok: false,
        status: 401,
        json: () =>
          new Promise((resolve, reject) => {
            readBody = resolve;
            signal.addEventListener('abort', () => {
              bodyAborted = true;
              reject(new Error('aborted'));
            });
          }),
      };
    });
    const caller = new AbortController();
    const logger = createLogger('https://logs.example/logs/sdk');
    const result = await fetchVaultDetails({
      sdkAuthorization: AUTH,
      environment: 'SANDBOX',
      signal: caller.signal,
      log: logger,
    });
    expect(result.ok).toBe(false);
    /* The session unmounts before the body is read. */
    caller.abort();
    readBody({ error: { code: 'IR_01', message: 'Unauthorized' } });
    await Promise.resolve();
    expect(bodyAborted).toBe(false);
    const failed = logs().find(
      (log) => log.event_name === 'PAYMENT_METHOD_SESSION_RETRIEVE_CALL'
    )!;
    expect(JSON.parse(failed.value!).response).toEqual({
      error: { code: 'IR_01', message: 'Unauthorized' },
    });
  });

  it('says why an answer it cannot use was refused', async () => {
    const logger = createLogger('https://logs.example/logs/sdk');
    answer(200, ['not', 'a', 'session']);
    await fetchVaultDetails({ sdkAuthorization: AUTH, log: logger });
    answer(200, { external_vault_details: { unknown_vault: {} } });
    await fetchVaultDetails({ sdkAuthorization: AUTH, log: logger });
    expect(
      logs()
        .filter((log) => log.event_name === 'INVALID_FORMAT')
        .map((log) => log.value)
    ).toEqual([
      'The payment-method-session response was not an object.',
      'The payment-method-session response names no vault this SDK supports.',
    ]);
    expect(JSON.stringify(batches)).not.toContain('unknown_vault');
  });
});
