// The vault's logs: hyperswitch-web's log structure, for the vault's own two API calls only.
// Runs on the ReScript output (`rescript` first), with `fetch` stubbed.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import * as VaultLogger from '../src/VaultLogger.bs.js';
import * as VaultConfirm from '../src/VaultConfirm.bs.js';
import * as VaultSavedCard from '../src/VaultSavedCard.bs.js';
import * as VaultEndpoint from '../src/VaultEndpoint.bs.js';

const LOG_URL = 'https://app.hyperswitch.io/api/logs/sdk';
const BASE_URL = 'https://app.hyperswitch.io/api';
const SESSION_ID = '12345_pms_test';
const PUBLISHABLE_KEY = 'pk_snd_test';
const SDK_AUTHORIZATION = Buffer.from(
  `publishable_key=${PUBLISHABLE_KEY},payment_method_session_id=${SESSION_ID},client_secret=cs_secret_1`,
).toString('base64');
const CARD = { cardNumber: '4242424242424242', expiryMonth: '12', expiryYear: '2030', cvc: '123' };
const CONFIRM_URL = `${BASE_URL}/v1/payment-method-sessions/${SESSION_ID}/confirm`;

const okJson = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const tokenBody = {
  associated_payment_methods: [{ payment_method_token: { data: 'tok_123' } }],
  payment_method_data: { card: { last4_digits: '4242', expiry_month: '12', expiry_year: '2030' } },
};

let realFetch;
let batches;
let vaultAnswer;
const logs = () => batches.flat();

beforeEach(() => {
  realFetch = globalThis.fetch;
  batches = [];
  vaultAnswer = async () => okJson(200, tokenBody);
  globalThis.fetch = async (url, options) => {
    if (url === LOG_URL) {
      batches.push(JSON.parse(options.body));
      return okJson(200, {});
    }
    await new Promise(resolve => setTimeout(resolve, 5));
    return vaultAnswer(url, options);
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const confirm = logger =>
  VaultConfirm.confirmPaymentMethodSession({
    sdkAuthorization: SDK_AUTHORIZATION,
    vaultBaseUrl: BASE_URL,
    card: CARD,
    logger,
  });

const confirmCall = logger => ({
  logger,
  eventName: 'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
  url: CONFIRM_URL,
  merchantId: PUBLISHABLE_KEY,
  paymentId: SESSION_ID,
});

test('a confirm queues its _INIT and answer, and they go out together as one batch', async () => {
  const logger = VaultLogger.make(LOG_URL, 'android');
  const outcome = await confirm(logger);

  assert.equal(outcome.status, 'success');
  assert.equal(batches.length, 0, 'INFO logs wait for the 20 s flush, as on web');

  VaultLogger.sendLogs(logger);
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].map(log => log.event_name), [
    'PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT',
    'PAYMENT_METHOD_SESSION_CONFIRM_CALL',
  ]);

  const [started, answered] = batches[0];
  assert.deepEqual(Object.keys(started).sort(), [
    'app_id', 'browser_name', 'browser_version', 'category', 'component', 'event_name',
    'first_event', 'latency', 'log_type', 'merchant_id', 'payment_id', 'payment_method',
    'platform', 'session_id', 'source', 'timestamp', 'user_agent', 'value', 'version',
  ]);
  assert.equal(started.log_type, 'INFO');
  assert.equal(started.category, 'API');
  assert.equal(started.source, 'HYPER_VAULT');
  assert.equal(started.component, 'MOBILE');
  assert.equal(started.platform, 'ANDROID');
  assert.equal(started.merchant_id, PUBLISHABLE_KEY);
  assert.equal(started.payment_id, SESSION_ID);
  assert.equal(started.session_id, logger.sessionId);
  assert.equal(started.first_event, 'true');
  assert.equal(started.latency, '');
  assert.deepEqual(JSON.parse(started.value), { url: CONFIRM_URL });

  assert.equal(answered.log_type, 'INFO');
  assert.deepEqual(JSON.parse(answered.value), { url: CONFIRM_URL, statusCode: 200 });
  assert.ok(Number(answered.latency) > 0, 'the answer carries its latency from its _INIT');

  VaultLogger.sendLogs(logger);
  assert.equal(batches.length, 1, 'an empty queue sends nothing');
});

test('queued logs go out on their own 20 s after the last one', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  VaultLogger.callStarted(confirmCall(VaultLogger.make(LOG_URL, 'ios')));

  t.mock.timers.tick(19999);
  assert.equal(batches.length, 0);
  t.mock.timers.tick(1);
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].event_name, 'PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT');
});

test('more than 8 queued logs go out at once', () => {
  const logger = VaultLogger.make(LOG_URL, 'android');
  for (let i = 0; i < 9; i++) VaultLogger.callStarted(confirmCall(logger));
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 9);
});

test('an HTTP error goes out at once, with the status and the error body as on web', async () => {
  const error = { error: { type: 'invalid_request', code: 'IR_16', message: 'Session already used' } };
  vaultAnswer = async () => okJson(400, error);
  const outcome = await confirm(VaultLogger.make(LOG_URL, 'android'));

  assert.equal(outcome.status, 'failure');
  assert.equal(batches.length, 1, 'an ERROR sends the queue immediately');
  const answered = batches[0][1];
  assert.equal(answered.event_name, 'PAYMENT_METHOD_SESSION_CONFIRM_CALL');
  assert.equal(answered.log_type, 'ERROR');
  assert.deepEqual(JSON.parse(answered.value), { url: CONFIRM_URL, statusCode: 400, response: error });
});

test('a request that gets no answer logs status 504 and the exception as web formats it', async () => {
  vaultAnswer = async () => {
    throw new TypeError('Network request failed');
  };
  const outcome = await confirm(VaultLogger.make(LOG_URL, 'android'));

  assert.equal(outcome.error.code, 'unknown_outcome');
  const answered = batches[0][1];
  const value = JSON.parse(answered.value);
  assert.equal(answered.log_type, 'ERROR');
  assert.equal(value.statusCode, 504);
  assert.equal(value.response.message, 'Network request failed');
  assert.equal(value.response.type, 'TypeError');
  assert.deepEqual(Object.keys(value.response).sort(), ['fileName', 'message', 'stack', 'type']);
});

test('no log carries a card value, the request body, a token or the client secret', async () => {
  const logger = VaultLogger.make(LOG_URL, 'ios');
  await confirm(logger);
  VaultLogger.sendLogs(logger);
  vaultAnswer = async () =>
    okJson(422, { error: { type: 'invalid_request', code: 'IR_05', message: 'Invalid card' } });
  await confirm(VaultLogger.make(LOG_URL, 'ios'));

  const sent = JSON.stringify(batches);
  for (const secret of [
    CARD.cardNumber,
    '424242',
    'card_cvc',
    'card_number',
    'tok_123',
    'cs_secret_1',
    SDK_AUTHORIZATION,
  ]) {
    assert.ok(!sent.includes(secret), `logs must not contain ${secret}`);
  }
});

test('first_event turns false on the second call of the same form', async () => {
  const logger = VaultLogger.make(LOG_URL, 'android');
  await confirm(logger);
  await confirm(logger);
  VaultLogger.sendLogs(logger);
  assert.deepEqual(logs().map(log => log.first_event), ['true', 'true', 'false', 'false']);
});

test('a saved-card CVC update logs PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT then _CALL', async () => {
  const logger = VaultLogger.make(LOG_URL, 'ios');
  const outcome = await VaultSavedCard.updateSavedPaymentMethod({
    vaultBaseUrl: BASE_URL,
    sdkAuthorization: SDK_AUTHORIZATION,
    paymentMethodToken: 'tok_saved',
    cvc: '123',
    logger,
  });
  VaultLogger.sendLogs(logger);

  assert.equal(outcome.status, 'success');
  assert.deepEqual(logs().map(log => log.event_name), [
    'PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT',
    'PAYMENT_METHOD_SESSION_UPDATE_CALL',
  ]);
  const url = `${BASE_URL}/v1/payment-method-sessions/${SESSION_ID}/update-saved-payment-method`;
  assert.deepEqual(JSON.parse(logs()[1].value), { url, statusCode: 200 });
  assert.ok(Number(logs()[1].latency) > 0);
  assert.ok(!JSON.stringify(batches).includes('tok_saved'));
});

test('each event sends at most 100 logs per form, as on web', () => {
  const logger = VaultLogger.make(LOG_URL, 'android');
  for (let i = 0; i < 120; i++) VaultLogger.callStarted(confirmCall(logger));
  VaultLogger.sendLogs(logger);
  assert.equal(logs().length, 100);
});

test('a call without a logger, or a logger without a URL, sends no logs', async () => {
  await confirm(undefined);
  const silent = VaultLogger.make(undefined, 'android');
  await confirm(silent);
  VaultLogger.sendLogs(silent);
  assert.equal(batches.length, 0);
});

test('a batch that cannot be sent does not change the outcome', async () => {
  const vaultFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url === LOG_URL) throw new Error('log collector down');
    return vaultFetch(url, options);
  };
  const logger = VaultLogger.make(LOG_URL, 'android');
  const outcome = await confirm(logger);
  VaultLogger.sendLogs(logger);
  assert.equal(outcome.status, 'success');
});

test('the log URL follows client-core’s rule on the backend the vault calls', () => {
  const url = VaultEndpoint.loggingUrl;
  assert.equal(url(undefined, 'SANDBOX'), 'https://app.hyperswitch.io/api/logs/sdk');
  assert.equal(url(undefined, 'PROD'), 'https://live.hyperswitch.io/api/logs/sdk');
  assert.equal(url(undefined, 'PROD_EU'), 'https://eu.hyperswitch.io/api/logs/sdk');
  assert.equal(url(undefined, 'INTEG'), 'https://integ.hyperswitch.io/api/logs/sdk');

  const logging = { overrideEndpoints: { customLoggingEndpoint: 'https://logs.example.com/collect' } };
  assert.equal(url(logging, 'PROD'), 'https://logs.example.com/collect');
  assert.equal(
    url({ commonEndpoint: 'https://pay.example.com/api/' }, 'PROD'),
    'https://pay.example.com/api/logs/sdk',
  );
  assert.equal(
    url({ overrideEndpoints: { customBackendEndpoint: 'https://pay.example.com/api' } }, 'PROD'),
    undefined,
    'a self-hosted backend without a logging endpoint sends no logs to Hyperswitch',
  );
  assert.equal(
    url({ overrideEndpoints: { customLoggingEndpoint: 'http://logs.example.com' } }, 'PROD'),
    undefined,
  );
  assert.equal(
    url({ overrideEndpoints: { customLoggingEndpoint: 'http://localhost:8080/logs' } }, 'SANDBOX'),
    'http://localhost:8080/logs',
  );
});
