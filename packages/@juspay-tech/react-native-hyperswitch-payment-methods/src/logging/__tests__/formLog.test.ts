import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';

import { createFormLog, logVgsSubmit } from '../formLog';
import { createLogger, setLogTransport } from '../logger';
import { registerAdapter } from '../../providers/registry';
import { errorResult } from '../../core/results';
import { fieldChange } from '../../core/fieldChange';
import type { ProviderAdapter } from '../../core/ProviderAdapter';
import type { ElementType, TokenizeResult } from '../../core/types';

let batches: Array<Array<Record<string, string>>>;

beforeEach(() => {
  batches = [];
  setLogTransport((_url, body) => batches.push(JSON.parse(body)));
});

afterEach(() => {
  setLogTransport(() => {});
  jest.useRealTimers();
});

function setup() {
  const logger = createLogger('https://logs.example/logs/sdk');
  const log = createFormLog(logger);
  const sent = () => {
    logger.sendLogs();
    return batches.flat();
  };
  return { logger, log, sent };
}

/* The end of a React commit: the lifecycle logs settle after it. */
const commit = () => Promise.resolve();

const named = (logs: Array<Record<string, string>>) =>
  logs.map((log) => `${log.event_name} ${log.log_type} ${log.value}`);

/* A field's mount, as web's PaymentMethodSession logs a field's create and then its mount. */
const mountedLines = (elementType: ElementType) => [
  `CARD_FORM_FLOW INFO ${elementType} created`,
  `PAYMENT_METHOD_SESSION_FIELD_MOUNTED INFO ${elementType}`,
  `CARD_FORM_FLOW INFO ${elementType} mounted`,
];

const CLOSED =
  'CARD_FORM_FLOW INFO Payment method session card form deinitialized';

const complete = (elementType: ElementType, done = true) =>
  fieldChange(elementType, {
    empty: !done,
    valid: done,
    touched: true,
  });

describe('the card form’s lifecycle', () => {
  it('logs web’s field events, by field name only', async () => {
    jest.useFakeTimers();
    const { log, sent } = setup();
    log.created();
    log.fieldMounted('cardNumber');
    await commit();
    jest.advanceTimersByTime(40);
    log.ready({ collector: true }, 'hyperswitch');
    log.fieldRendered('cardNumber');
    log.cleared('cardNumber');
    log.fieldUnmounted('cardNumber');
    log.deinitialized();
    await commit();

    const logs = sent();
    expect(named(logs)).toEqual([
      ...mountedLines('cardNumber'),
      'PAYMENT_METHOD_SESSION_FIELD_RENDERED INFO cardNumber',
      'CLEAR INFO cardNumber',
      'CARD_FORM_FLOW INFO cardNumber unmounted',
      CLOSED,
    ]);
    expect(logs[3]!.latency).toBe('40');
  });

  it('logs each field’s create and mount, in the order React mounted them', async () => {
    const { log, sent } = setup();
    log.fieldMounted('cardNumber');
    log.fieldMounted('cardCvc');
    log.created();
    await commit();
    expect(named(sent())).toEqual([
      ...mountedLines('cardNumber'),
      ...mountedLines('cardCvc'),
    ]);
  });

  it('logs a field that remounts in one commit once, rendered since its first mount', async () => {
    jest.useFakeTimers();
    const { log, sent } = setup();
    log.created();
    log.fieldMounted('cardNumber');
    await commit();
    jest.advanceTimersByTime(25);
    /* The provider arrived: React moves the fields under it. */
    log.fieldUnmounted('cardNumber');
    log.fieldMounted('cardNumber');
    await commit();
    jest.advanceTimersByTime(15);
    log.fieldRendered('cardNumber');

    const logs = sent();
    expect(named(logs)).toEqual([
      ...mountedLines('cardNumber'),
      'PAYMENT_METHOD_SESSION_FIELD_RENDERED INFO cardNumber',
    ]);
    expect(logs[3]!.latency).toBe('40');
  });

  it('sends the fields’ unmounts with the form’s close, after the form closed first', async () => {
    const { log } = setup();
    log.created();
    log.fieldMounted('cardNumber');
    log.fieldMounted('cardCvc');
    await commit();
    /* React runs the form's cleanup before its fields'. */
    log.deinitialized();
    log.fieldUnmounted('cardNumber');
    log.fieldUnmounted('cardCvc');
    await commit();

    expect(batches).toHaveLength(1);
    expect(named(batches[0]!)).toEqual([
      ...mountedLines('cardNumber'),
      ...mountedLines('cardCvc'),
      'CARD_FORM_FLOW INFO cardNumber unmounted',
      'CARD_FORM_FLOW INFO cardCvc unmounted',
      CLOSED,
    ]);
  });

  it('logs the fields’ mounts before their renders when the logger arrives after the fields are ready', async () => {
    const { log, sent } = setup();
    const mountedAt = Date.now() - 300;
    /* Fields' effects run before their form's: each mounts and is already rendered. */
    log.fieldMounted('cardNumber', mountedAt);
    log.fieldRendered('cardNumber');
    log.fieldMounted('cardCvc', mountedAt);
    log.fieldRendered('cardCvc');
    log.created();
    log.ready({}, 'vgs');
    await commit();

    const logs = sent();
    expect(named(logs)).toEqual([
      ...mountedLines('cardNumber'),
      ...mountedLines('cardCvc'),
      'PAYMENT_METHOD_SESSION_FIELD_RENDERED INFO cardNumber',
      'PAYMENT_METHOD_SESSION_FIELD_RENDERED INFO cardCvc',
      'VGS_VAULT_FLOW INFO VGS collect form created',
    ]);
    expect(Number(logs[6]!.latency)).toBeGreaterThanOrEqual(300);
  });

  it('logs nothing for a development double effect', async () => {
    const { log, sent } = setup();
    log.created();
    log.fieldMounted('cardNumber');
    log.fieldUnmounted('cardNumber');
    log.deinitialized();
    log.created();
    log.fieldMounted('cardNumber');
    await commit();
    expect(named(sent())).toEqual(mountedLines('cardNumber'));
  });

  it('says the form never became usable when no provider is ready in time', async () => {
    jest.useFakeTimers();
    const { log, sent } = setup();
    log.created();
    await commit();
    log.providerStarting(3_000);
    jest.advanceTimersByTime(3_000);
    expect(named(sent())).toEqual([
      'CARD_FORM_FLOW ERROR Card form failed: not_ready_after_3000ms',
    ]);
  });

  it('does not count a slow session lookup against the form', async () => {
    jest.useFakeTimers();
    const { log, sent } = setup();
    log.created();
    await commit();
    /* No vault details yet: the provider has not started. */
    jest.advanceTimersByTime(60_000);
    log.providerStarting(3_000);
    jest.advanceTimersByTime(2_000);
    log.ready({}, 'hyperswitch');
    jest.advanceTimersByTime(60_000);
    expect(named(sent())).toEqual([]);
  });

  it('says when a form logged as not ready became ready after all', async () => {
    jest.useFakeTimers();
    const { log, sent } = setup();
    log.created();
    await commit();
    log.providerStarting(3_000);
    jest.advanceTimersByTime(4_500);
    log.ready({}, 'hyperswitch');
    log.ready({}, 'hyperswitch');
    expect(named(sent())).toEqual([
      'CARD_FORM_FLOW ERROR Card form failed: not_ready_after_3000ms',
      'CARD_FORM_FLOW INFO Card form ready after 4500ms',
    ]);
  });

  it('does not say so once the provider is ready, or the form has closed', () => {
    jest.useFakeTimers();
    const ready = setup();
    ready.log.created();
    ready.log.providerStarting();
    ready.log.ready({}, 'vgs');
    const closed = setup();
    closed.log.created();
    closed.log.providerStarting();
    closed.log.deinitialized();
    jest.advanceTimersByTime(60_000);
    expect(
      named(batches.flat()).filter((line) => line.includes('failed'))
    ).toEqual([]);
  });

  it('logs each reason a form failed once, as an error', () => {
    const { log, sent } = setup();
    log.failed('provider_failed');
    log.failed('provider_failed');
    log.failed('invalid_vault_data');
    const logs = sent();
    expect(named(logs)).toEqual([
      'CARD_FORM_FLOW ERROR Card form failed: provider_failed',
      'CARD_FORM_FLOW ERROR Card form failed: invalid_vault_data',
    ]);
    expect(logs.every((entry) => entry.category === 'USER_ERROR')).toBe(true);
  });
});

describe('PAYMENT_METHOD_SESSION_DATA_FILLED', () => {
  it('is logged once the card is complete, and once more with the name, as web', async () => {
    const { log, sent } = setup();
    for (const type of [
      'cardholderName',
      'cardNumber',
      'cardExpiry',
      'cardCvc',
    ] as const) {
      log.fieldMounted(type);
    }
    await commit();
    log.fieldChanged(complete('cardNumber'));
    log.fieldChanged(complete('cardCvc'));
    log.fieldChanged(complete('cardExpiry'));
    log.fieldChanged(complete('cardExpiry'));
    log.fieldChanged(complete('cardholderName'));
    log.fieldChanged(complete('cardholderName', false));
    log.fieldChanged(complete('cardholderName'));

    expect(
      sent()
        .filter(
          (entry) => entry.event_name === 'PAYMENT_METHOD_SESSION_DATA_FILLED'
        )
        .map((entry) => entry.value)
    ).toEqual([
      'cardNumber,cardExpiry,cardCvc',
      'cardNumber,cardExpiry,cardCvc,cardholderName',
    ]);
  });

  it('is the CVC alone for a saved card', async () => {
    const { log, sent } = setup();
    log.fieldMounted('cardCvc');
    await commit();
    log.fieldChanged(complete('cardCvc'));
    expect(
      sent()
        .filter(
          (entry) => entry.event_name === 'PAYMENT_METHOD_SESSION_DATA_FILLED'
        )
        .map((entry) => entry.value)
    ).toEqual(['cardCvc']);
  });
});

describe('tokenize', () => {
  const builtIn = { vaultType: 'hyperswitch' } as ProviderAdapter;

  it('files the outcome under the session the attempt started in', async () => {
    const { logger, log, sent } = setup();
    const authorization = (sessionId: string) =>
      Buffer.from(
        `publishable_key=pk_snd_test,payment_method_session_id=${sessionId}`,
        'utf8'
      ).toString('base64');
    logger.identify(authorization('0a_pms_first'), 'pk_snd_test');
    const firstSession = logger.sessionId;
    let finish: (result: TokenizeResult) => void = () => {};
    const attempt = log.tokenize(
      'hyperswitch',
      builtIn,
      () =>
        new Promise<TokenizeResult>((resolve) => {
          finish = resolve;
        })
    );
    logger.identify(authorization('0a_pms_second'), 'pk_snd_test');
    expect(logger.sessionId).not.toBe(firstSession);
    finish({
      status: 'success',
      vaultType: 'hyperswitch',
      data: { tokens: { payment_method_token: 'token_secret_value' } },
    });
    await attempt;

    expect(
      sent()
        .filter((entry) => entry.event_name?.includes('TOKENIZE'))
        .map((entry) => [
          entry.event_name,
          entry.payment_id,
          entry.session_id === firstSession,
        ])
    ).toEqual([
      ['PAYMENT_METHOD_SESSION_TOKENIZE_INIT', '0a_pms_first', true],
      ['PAYMENT_METHOD_SESSION_TOKENIZE', '0a_pms_first', true],
    ]);
  });

  it('logs a tokenize called again while one is in flight once', async () => {
    const { log, sent } = setup();
    let finish: (result: TokenizeResult) => void = () => {};
    const shared = new Promise<TokenizeResult>((resolve) => {
      finish = resolve;
    });
    const first = log.tokenize('vgs', null, () => shared);
    const second = log.tokenize('vgs', null, () => shared);
    finish(
      errorResult('vgs', 'tokenization_failed', 'VGS returned status 500.')
    );
    await Promise.all([first, second]);
    expect(named(sent()).filter((line) => line.includes('TOKENIZE'))).toEqual([
      'PAYMENT_METHOD_SESSION_TOKENIZE_INIT INFO vgs',
      'PAYMENT_METHOD_SESSION_TOKENIZE ERROR {"vaultType":"vgs","code":"tokenization_failed","message":""}',
    ]);
    /* The next attempt is logged again. */
    await log.tokenize('vgs', null, () => shared);
    expect(
      named(batches.flat()).filter((line) => line.includes('TOKENIZE_INIT'))
    ).toHaveLength(2);
  });

  it('logs the attempt and its outcome, and returns the result unchanged', async () => {
    const { log, sent } = setup();
    const success: TokenizeResult = {
      status: 'success',
      vaultType: 'hyperswitch',
      data: { tokens: { payment_method_token: 'token_secret_value' } },
    };
    await expect(
      log.tokenize('hyperswitch', builtIn, async () => success)
    ).resolves.toBe(success);
    const logs = sent();
    expect(named(logs)).toEqual([
      'PAYMENT_METHOD_SESSION_TOKENIZE_INIT INFO hyperswitch',
      'PAYMENT_METHOD_SESSION_TOKENIZE INFO {"vaultType":"hyperswitch"}',
    ]);
    expect(JSON.stringify(logs)).not.toMatch(/token_secret_value/);
  });

  it('keeps the message only where the SDK writes it, as web keeps it for the Hyperswitch vault', async () => {
    const { log, sent } = setup();
    const outcome = async (
      vaultType: 'hyperswitch' | 'vgs',
      result: TokenizeResult,
      adapter: ProviderAdapter | null = builtIn
    ) => log.tokenize(vaultType, adapter, async () => result);

    await outcome(
      'hyperswitch',
      errorResult('hyperswitch', 'session_expired', 'This session has expired.')
    );
    await outcome(
      'hyperswitch',
      errorResult(
        'hyperswitch',
        'tokenization_failed',
        'Hyperswitch vaultData requires a non-empty string "sdkAuthorization". Received: {"sdk_authorization":"c2VjcmV0"}'
      )
    );
    await outcome(
      'vgs',
      errorResult(
        'vgs',
        'validation_error',
        'VGS field state: 4242424242424242'
      )
    );

    const messages = sent()
      .filter((entry) => entry.event_name === 'PAYMENT_METHOD_SESSION_TOKENIZE')
      .map((entry) => JSON.parse(entry.value!));
    expect(messages).toEqual([
      {
        vaultType: 'hyperswitch',
        code: 'session_expired',
        message: 'This session has expired.',
      },
      { vaultType: 'hyperswitch', code: 'tokenization_failed', message: '' },
      { vaultType: 'vgs', code: 'validation_error', message: '' },
    ]);
  });
});

describe('crashes and VGS', () => {
  const hyperswitchVault = { vaultType: 'hyperswitch' } as ProviderAdapter;

  it('keeps a crash’s error text only for the Hyperswitch vault, as a tokenize message', () => {
    const { log, sent } = setup();
    const crash = () => new Error('Invalid CVC: 973; token: tok_review_secret');
    log.crashed('cardCvc', crash(), { vaultType: 'vgs' } as ProviderAdapter);
    const custom = { vaultType: 'hyperswitch' } as ProviderAdapter;
    const unregister = registerAdapter(custom);
    try {
      log.crashed('cardNumber', crash(), custom);
    } finally {
      unregister();
    }
    log.crashed('cardExpiry', crash(), null);
    log.crashed('cardholderName', crash(), hyperswitchVault);

    const crashes = sent()
      .filter((entry) => entry.event_name === 'SDK_CRASH')
      .map((entry) => JSON.parse(entry.value!));
    expect(crashes.slice(0, 3)).toEqual([
      { type: 'Error', vaultType: 'vgs', componentName: 'cardCvc' },
      { type: 'Error', vaultType: 'hyperswitch', componentName: 'cardNumber' },
      { type: 'Error', vaultType: '', componentName: 'cardExpiry' },
    ]);
    expect(JSON.stringify(crashes.slice(0, 3))).not.toMatch(/973|tok_review/);
    expect(crashes[3]).toEqual({
      type: 'Error',
      message: 'Invalid CVC: ***; token: tok_review_secret',
      componentName: 'cardholderName',
    });
  });

  it('logs only the kind of value a field threw when it is not an Error', () => {
    const { log, sent } = setup();
    log.crashed(
      'cardCvc',
      { cvc: '123', expiry: '12/30', name: 'Jane Doe' },
      hyperswitchVault
    );
    log.crashed('cardExpiry', ['12', '30'], hyperswitchVault);
    log.crashed('cardholderName', null, null);
    const crashes = sent().filter((entry) => entry.event_name === 'SDK_CRASH');
    expect(crashes.map((entry) => JSON.parse(entry.value!))).toEqual([
      { thrown: 'object', componentName: 'cardCvc' },
      { thrown: 'array', componentName: 'cardExpiry' },
      { thrown: 'null', componentName: 'cardholderName' },
    ]);
    expect(JSON.stringify(crashes)).not.toMatch(/123|12\/30|Jane/);
  });

  it('logs a crash once per type and message, without card-shaped digits', () => {
    const { log, sent } = setup();
    const first = new Error('render failed at 4242 4242 4242 4242');
    const again = new Error('render failed at 4242 4242 4242 4242');
    again.stack = `${again.stack}\n    at a React retry frame`;
    log.crashed('cardNumber', first, hyperswitchVault);
    log.crashed('cardNumber', again, hyperswitchVault);
    log.crashed('cardCvc', 'boom', hyperswitchVault);

    const crashes = sent().filter((entry) => entry.event_name === 'SDK_CRASH');
    expect(crashes).toHaveLength(2);
    expect(crashes[0]).toMatchObject({
      log_type: 'ERROR',
      category: 'USER_ERROR',
    });
    expect(JSON.parse(crashes[0]!.value!)).toMatchObject({
      message: 'render failed at [redacted]',
      type: 'Error',
      componentName: 'cardNumber',
    });
    expect(JSON.parse(crashes[1]!.value!)).toEqual({
      thrown: 'string',
      componentName: 'cardCvc',
    });
    expect(JSON.stringify(crashes)).not.toMatch(/4242/);
  });

  it('logs VGS’s collect form and each submit’s status, never its response', () => {
    const { log, sent } = setup();
    const collector = { submit: () => undefined };
    log.ready(collector, 'vgs');
    logVgsSubmit(collector, 200);
    logVgsSubmit(collector, 422);
    logVgsSubmit(collector);
    logVgsSubmit({ unbound: true }, 500);
    expect(
      named(sent()).filter((line) => line.startsWith('VGS_VAULT_FLOW'))
    ).toEqual([
      'VGS_VAULT_FLOW INFO VGS collect form created',
      'VGS_VAULT_FLOW INFO VGS submit status: 200',
      'VGS_VAULT_FLOW ERROR VGS submit status: 422',
      'VGS_VAULT_FLOW ERROR VGS submit failed',
    ]);
  });
});
