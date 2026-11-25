// The merchant-side wrappers' parts that need no React: the rule for when the native path may run,
// what is sent to the vault's own engine, and how its answers are read back.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { supports } from '../src/native/rule.mjs';
import { fieldOut, formSettings, read, tokenizeResultOf } from '../src/native/out.mjs';
import { forwardingHandle } from '../src/native/handle.mjs';
import { PROTOCOL_VERSION, TESTED_REACT_NATIVE } from '../src/hosted/protocol.mjs';

const good = { newArchitecture: true, bundled: true, protocolVersion: PROTOCOL_VERSION, reactNativeMinor: 86 };
/* StyleSheet.flatten, near enough: arrays merged left to right, falsy entries skipped. */
const flatten = (style) => (Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : style ?? undefined);

test('rule: the native path runs only when every condition holds', () => {
  assert.equal(supports(good), true);
  assert.equal(supports({ ...good, newArchitecture: false }), false, 'old architecture');
  assert.equal(supports({ ...good, bundled: false }), false, 'a build without the bundle');
  assert.equal(supports({ ...good, protocolVersion: PROTOCOL_VERSION + 1 }), false, 'JavaScript newer than the app');
  assert.equal(supports({ ...good, protocolVersion: PROTOCOL_VERSION - 1 }), false, 'JavaScript older than the app');
  assert.equal(supports(null), false);
  assert.equal(supports(undefined), false);
  assert.equal(supports({}), false);
  assert.equal(supports({ ...good, reactNativeMinor: '86' }), false, 'a version that is not a number');
});

test('rule: only the tested React Native versions, at both ends', () => {
  assert.equal(supports({ ...good, reactNativeMinor: TESTED_REACT_NATIVE.from }), true);
  assert.equal(supports({ ...good, reactNativeMinor: TESTED_REACT_NATIVE.to }), true);
  assert.equal(supports({ ...good, reactNativeMinor: TESTED_REACT_NATIVE.from - 1 }), false, 'older than tested');
  assert.equal(supports({ ...good, reactNativeMinor: TESTED_REACT_NATIVE.to + 1 }), false, 'newer than tested');
});

test('out: a form sends its data props and nothing else', () => {
  const sent = JSON.parse(
    formSettings({
      vaultDetails: { vaultType: 'hyperswitch', vaultData: { sdkAuthorization: 'abc' } },
      environment: 'SANDBOX',
      locale: 'fr',
      disabled: false,
      onChange: () => {},
      onReady: () => {},
      children: 'x',
      ref: {},
      somethingElse: 1,
    })
  );
  assert.deepEqual(sent, {
    vaultDetails: { vaultType: 'hyperswitch', vaultData: { sdkAuthorization: 'abc' } },
    environment: 'SANDBOX',
    locale: 'fr',
    disabled: false,
  });
});

test('out: equal props give equal text, so a re-render sends no update', () => {
  const props = () => ({ environment: 'SANDBOX', appearance: { variables: { colorText: '#000' } }, onChange: () => {} });
  assert.equal(formSettings(props()), formSettings(props()));
  assert.notEqual(formSettings(props()), formSettings({ ...props(), locale: 'de' }));
});

test('out: a field sends its data props; callbacks and unknown props stay behind', () => {
  const { settings, placement } = fieldOut(
    { placeholder: 'Card', labelBehavior: 'floating', options: { savedCard: { paymentMethodToken: 'pm_1' } }, onChange: () => {}, style: { color: 'red' } },
    flatten
  );
  assert.deepEqual(JSON.parse(settings), {
    placeholder: 'Card',
    labelBehavior: 'floating',
    options: { savedCard: { paymentMethodToken: 'pm_1' } },
  });
  assert.deepEqual(placement, {});
});

test('out: where the field sits goes on the native view; how it looks goes inside', () => {
  const { settings, placement } = fieldOut(
    {
      styles: {
        root: [{ flex: 1, marginTop: 8 }, { padding: 4, backgroundColor: '#fff', width: 200 }],
        input: { color: '#111', fontSize: 16 },
        error: null,
      },
    },
    flatten
  );
  assert.deepEqual(placement, { flex: 1, marginTop: 8, width: 200 });
  assert.deepEqual(JSON.parse(settings).styles, {
    root: { padding: 4, backgroundColor: '#fff' },
    input: { color: '#111', fontSize: 16 },
  });
});

test('out: unreadable text from the other side is an empty object, never an exception', () => {
  assert.deepEqual(read('{"height":48}'), { height: 48 });
  assert.deepEqual(read('{not json'), {});
  assert.deepEqual(read('[1,2]').length, 2);
  assert.deepEqual(read('"text"'), {});
  assert.deepEqual(read(undefined), {});
  assert.deepEqual(read('null'), {});
});

test('out: a tokenize answer is the vault\'s result; a command that did not run is an ordinary refusal', () => {
  const result = { status: 'success', token: 'tok_123', card: { last4: '4242', expiryMonth: '12', expiryYear: '2030' } };
  assert.deepEqual(tokenizeResultOf(JSON.stringify({ commandId: 'c', name: 'tokenize', ok: true, result })), result);

  const refused = { status: 'validation_error', error: { code: 'validation_error', message: 'Enter a card number.', type: 'validation_error' } };
  assert.deepEqual(tokenizeResultOf(JSON.stringify({ ok: true, result: refused })), refused);

  assert.deepEqual(tokenizeResultOf(JSON.stringify({ ok: false, message: 'The card form was closed.' })), {
    status: 'error',
    error: { code: 'tokenization_failed', message: 'The card form was closed.', type: 'api_error' },
  });
  for (const broken of ['{not json', '', undefined, '{"ok":true}', '{"ok":true,"result":null}']) {
    const out = tokenizeResultOf(broken);
    assert.equal(out.status, 'error');
    assert.equal(out.error.code, 'tokenization_failed');
    assert.equal(typeof out.error.message, 'string');
  }
});

test('out: a tokenize that reached the vault\'s engine and got no answer is an unknown outcome, never a failure', () => {
  for (const message of ['The card form did not answer.', 'The card form was closed.', "The card form's engine stopped."]) {
    const out = tokenizeResultOf(JSON.stringify({ ok: false, message, delivered: true }));
    assert.equal(out.status, 'error');
    assert.equal(out.error.code, 'unknown_outcome');
    assert.equal(out.error.type, 'api_error');
    assert.equal(typeof out.error.message, 'string');
  }
  /* Not delivered (never reached the engine): an ordinary refusal, as before. */
  assert.equal(tokenizeResultOf(JSON.stringify({ ok: false, message: 'The card form is not open.' })).error.code, 'tokenization_failed');
  assert.equal(tokenizeResultOf(JSON.stringify({ ok: false, message: 'x', delivered: 'yes' })).error.code, 'tokenization_failed');
});

test('handle: one object that follows whichever form is mounted, and refuses when none is', async () => {
  let mounted = null;
  const handle = forwardingHandle(() => mounted);

  /* Nothing mounted: refusals, never a throw. */
  assert.equal((await handle.tokenize()).error.code, 'incomplete_field_set');
  assert.equal((await handle.confirmPayment({})).error.code, 'unsupported_configuration');
  handle.reset();
  handle.focus('cardNumber');

  /* The native form (no confirmPayment), then a switch to the plain one: the same handle reaches each. */
  const calls = [];
  mounted = {
    tokenize: async () => ({ status: 'success', token: 'from-native' }),
    reset: () => calls.push('native reset'),
    focus: (field) => calls.push(`native focus ${field}`),
  };
  assert.equal((await handle.tokenize()).token, 'from-native');
  assert.equal((await handle.confirmPayment({})).error.code, 'unsupported_configuration');
  handle.reset();
  handle.focus('cardCvc');

  mounted = {
    tokenize: async () => ({ status: 'success', token: 'from-plain' }),
    confirmPayment: async (input) => ({ status: 'succeeded', input }),
    reset: () => calls.push('plain reset'),
    focus: (field) => calls.push(`plain focus ${field}`),
  };
  assert.equal((await handle.tokenize()).token, 'from-plain');
  assert.deepEqual(await handle.confirmPayment({ a: 1 }), { status: 'succeeded', input: { a: 1 } });
  handle.reset();
  handle.focus('cardExpiry');

  assert.deepEqual(calls, ['native reset', 'native focus cardCvc', 'plain reset', 'plain focus cardExpiry']);
});
