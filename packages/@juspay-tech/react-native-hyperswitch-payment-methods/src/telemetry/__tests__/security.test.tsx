/*
 * End to end with the real (vendored) shared logger: every request body it sends is read back
 * and checked for the secrets this flow handles. The other tests use the recording mock that
 * jest.setup.js installs.
 */
import { createRef } from 'react';
import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';
import { render, act, waitFor } from '@testing-library/react-native';

jest.unmock('../vendor/hyperswitch-logger');

import { HyperPaymentMethodSession } from '../../session/HyperPaymentMethodSession';
import { CardForm } from '../../core/CardForm';
import { registerAdapter } from '../../providers/registry';
import { CardNumberField, CardExpiryField, CardCVCField } from '../../fields';
import { createMockAdapter } from '../../__fixtures__/mockAdapter';
import { createLogger } from '../vendor/hyperswitch-logger';
import type { CardFormHandle } from '../../core/types';

const CLIENT_SECRET = 'pms_secret_9f8e7d6c5b4a';
const SDK_AUTHORIZATION = Buffer.from(
  `publishable_key=pk_snd_sec,client_secret=${CLIENT_SECRET},payment_method_session_id=0a_pms_0192`,
  'utf8'
).toString('base64');
const VAULT_ID = 'tnt_vault_secret_id';
const TOKEN = 'tok_card_alias_secret';

const LOG_KEYS = [
  'timestamp',
  'log_type',
  'component',
  'category',
  'version',
  'code_push_version',
  'client_core_version',
  'value',
  'internal_metadata',
  'session_id',
  'merchant_id',
  'payment_id',
  'app_id',
  'platform',
  'user_agent',
  'event_name',
  'first_event',
  'payment_method',
  'payment_experience',
  'latency',
  'source',
].sort();

type Sent = {
  url: string;
  init: { body: string; headers: Record<string, string> };
};
const cleanups: Array<() => void> = [];
const originalFetch = globalThis.fetch;
let sent: Sent[];

beforeEach(() => {
  sent = [];
  (globalThis as { fetch?: unknown }).fetch = jest.fn(
    async (url: string, init: Sent['init']) => {
      sent.push({ url, init });
      if (url.includes('/logs/sdk')) return { ok: true, status: 200 };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: '0a_pms_0192',
          external_vault_details: {
            vgs: { external_vault_id: VAULT_ID, sdk_env: 'sandbox' },
          },
        }),
      };
    }
  );
});

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  (globalThis as { fetch?: unknown }).fetch = originalFetch;
});

describe('what reaches the logging endpoint', () => {
  it('is fixed-shape records with no credential, vault id or token in them', async () => {
    cleanups.push(
      registerAdapter(
        createMockAdapter({
          vaultType: 'vgs',
          fieldState: { empty: false, valid: true, touched: true },
          tokenizeResult: {
            status: 'success',
            vaultType: 'vgs',
            data: { tokens: { card_number: TOKEN }, raw: { token: TOKEN } },
          },
        })
      )
    );
    const ref = createRef<CardFormHandle>();

    const view = render(
      <HyperPaymentMethodSession
        hyper={{ publishableKey: 'pk_snd_sec', environment: 'SANDBOX' }}
        options={{ sdkAuthorization: SDK_AUTHORIZATION }}
      >
        <CardForm ref={ref}>
          <CardNumberField />
          <CardExpiryField />
          <CardCVCField />
        </CardForm>
      </HyperPaymentMethodSession>
    );

    const logs = () => sent.filter((call) => call.url.includes('/logs/sdk'));
    const eventsSent = () =>
      logs().map((call) => JSON.parse(call.init.body).event_name as string);

    await waitFor(() =>
      expect(eventsSent()).toContain('PAYMENT_METHOD_SESSION_DATA_FILLED')
    );
    await act(async () => {
      await ref.current!.tokenize();
    });
    await waitFor(() =>
      expect(eventsSent()).toContain('PAYMENT_METHOD_SESSION_TOKENIZE')
    );
    view.unmount();

    expect(logs().length).toBeGreaterThan(0);
    const bodies = logs().map((call) => JSON.parse(call.init.body));
    for (const body of bodies) {
      expect(Object.keys(body).sort()).toEqual(LOG_KEYS);
      expect(body.merchant_id).toBe('pk_snd_sec');
      expect(body.source).toBe('PAYMENT_METHODS_SDK');
    }
    expect(new Set(bodies.map((body) => body.session_id)).size).toBe(1);
    expect(logs()[0]!.url).toBe('https://app.hyperswitch.io/api/logs/sdk');
    expect(logs()[0]!.init.headers['api-key']).toBe('pk_snd_sec');

    const everythingSent = JSON.stringify(logs().map((call) => call.init));
    for (const secret of [
      SDK_AUTHORIZATION,
      CLIENT_SECRET,
      VAULT_ID,
      TOKEN,
      'card_number',
    ]) {
      expect(everythingSent).not.toContain(secret);
    }
    /* The lookup did carry the authorization, so the scan above is meaningful. */
    const lookup = sent.find((call) => !call.url.includes('/logs/sdk'))!;
    expect(JSON.stringify(lookup.init)).toContain(SDK_AUTHORIZATION);
  });

  it('goes to /logs/sdk under a commonEndpoint, the same base the API calls use', async () => {
    const view = render(
      <HyperPaymentMethodSession
        hyper={{
          publishableKey: 'pk_snd_sec',
          customEndpoints: { commonEndpoint: 'https://hs.merchant.test/api/' },
        }}
        options={{ sdkAuthorization: SDK_AUTHORIZATION }}
      >
        <CardForm />
      </HyperPaymentMethodSession>
    );

    await waitFor(() =>
      expect(sent.some((call) => call.url.endsWith('/logs/sdk'))).toBe(true)
    );
    view.unmount();

    expect(
      new Set(sent.map((call) => call.url.replace(/\/v1\/.*$/, '/v1/…')))
    ).toEqual(
      new Set([
        'https://hs.merchant.test/api/v1/…',
        'https://hs.merchant.test/api/logs/sdk',
      ])
    );
  });

  it('reports a crash by its error name only, never its message', () => {
    const logger = createLogger();
    logger.configure({
      publishableKey: 'pk_snd_sec',
      environment: 'SANDBOX',
      sessionId: 'session',
      sdkVersion: '1.1.0',
      source: 'PAYMENT_METHODS_SDK',
    });
    logger.logCrash(
      new SyntaxError(
        `JSON Parse error: "${CLIENT_SECRET}" 4111111111111111 737`
      )
    );
    logger.logCrash('a thrown string 737');
    logger.dispose();

    const crashes = sent
      .filter((call) => call.url.includes('/logs/sdk'))
      .map((call) => JSON.parse(call.init.body))
      .filter((body) => body.event_name === 'SDK_CRASH');
    expect(crashes.map((body) => body.value)).toEqual(['SyntaxError', 'Error']);
    expect(JSON.stringify(crashes)).not.toMatch(/737|4111|pms_secret/);
  });
});
