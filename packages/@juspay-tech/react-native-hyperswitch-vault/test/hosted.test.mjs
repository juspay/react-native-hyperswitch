// The hosted layer's parts that need no React: the allow-list for what leaves the engine, the
// registry that joins a form's roots, the command runner, and the bridge. Runs on the ReScript
// output (`rescript` first). The two React roots are exercised where a renderer exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encode, payloadOf, tokenizeResult, MAX_TEXT, NOT_PASSED_ON } from '../src/hosted/wire.mjs';
import { attachField, getForm, openForm, subscribe } from '../src/hosted/forms.mjs';
import { run, startCommands } from '../src/hosted/commands.mjs';
import { makeBridge } from '../src/hosted/bridge.mjs';
import { FormEvent, FieldEvent } from '../src/hosted/protocol.mjs';

const PAN = '4242424242424242';
const CVC = '737';

// What a <CardForm> gives a merchant's onChange today, captured from the built vault.
const formChange = {
  elementType: 'cardForm',
  eventName: 'cardDetailsChange',
  payload: {
    bin: '424242',
    extendedBin: '42424242',
    last4: '4242',
    brand: 'Visa',
    expiryMonth: '12',
    expiryYear: '2030',
    formattedExpiry: '12 / 30',
    isCardNumberComplete: true,
    isCvcComplete: true,
    isExpiryComplete: true,
    isCardNumberValid: true,
    isExpiryValid: true,
  },
  fieldsReady: true,
  sessionStatus: 'valid',
  complete: true,
  valid: true,
  submitting: false,
  canSubmit: true,
  isCoBadged: false,
  eligibility: 'unknown',
  fields: {
    cardNumber: { elementType: 'cardNumber', empty: false, complete: true, valid: true, brand: 'Visa', touched: false, isCoBadged: false, eligibility: 'unknown' },
    cardExpiry: { elementType: 'cardExpiry', empty: false, complete: true, valid: true, touched: false },
    cardCvc: { elementType: 'cardCvc', empty: false, complete: true, valid: true, brand: 'Visa', touched: false },
  },
};

test('wire: today\'s form change and field change pass unchanged', () => {
  assert.deepEqual(payloadOf(FormEvent.Change, formChange), formChange);
  assert.deepEqual(payloadOf(FieldEvent.Change, formChange.fields.cardNumber), formChange.fields.cardNumber);
  assert.deepEqual(JSON.parse(encode(FormEvent.Change, formChange)), formChange);
});

test('wire: a key that is not listed never leaves, wherever it is put', () => {
  const smuggled = {
    ...formChange,
    cardNumber: PAN,
    payload: { ...formChange.payload, cardNumber: PAN, cvc: CVC },
    fields: { ...formChange.fields, cardNumber: { ...formChange.fields.cardNumber, value: PAN } },
  };
  const sent = encode(FormEvent.Change, smuggled);
  assert.ok(!sent.includes(PAN));
  assert.ok(!sent.includes(CVC));
  assert.deepEqual(JSON.parse(sent), formChange);
});

test('wire: a listed key cannot carry a card number', () => {
  for (const key of ['bin', 'extendedBin', 'last4', 'brand', 'expiryMonth', 'expiryYear', 'formattedExpiry']) {
    const sent = encode(FormEvent.Change, { ...formChange, payload: { ...formChange.payload, [key]: PAN } });
    assert.ok(!sent.includes(PAN), `${key} carried a card number`);
    assert.equal(key in JSON.parse(sent).payload, false, `${key} was not left out`);
  }
  const field = encode(FieldEvent.Change, { ...formChange.fields.cardNumber, brand: PAN, errorCode: PAN, elementType: PAN });
  assert.ok(!field.includes(PAN));
});

test('wire: text written by people has card-number shapes blanked and is cut short', () => {
  const sent = JSON.parse(
    encode(FieldEvent.Change, { ...formChange.fields.cardNumber, error: `Card 4242 4242 4242 4242 was declined` })
  );
  assert.equal(sent.error, 'Card [redacted] was declined');
  const long = JSON.parse(encode(FormEvent.Error, { message: 'x'.repeat(5000) }));
  assert.equal(long.message.length, MAX_TEXT);
  assert.equal(JSON.parse(encode(FieldEvent.Error, { elementType: 'cardCvc', message: `cvc ${PAN}` })).message, 'cvc [redacted]');
});

test('wire: an event this bundle does not send is not sent', () => {
  assert.equal(encode('VAULT_CARD_DUMP', { cardNumber: PAN }), null);
  assert.equal(payloadOf('PM_FORM_CHANGE', formChange), null);
});

test('wire: a layout carries a height and nothing else', () => {
  assert.equal(encode(FieldEvent.Layout, { height: 47.2, width: 300, text: PAN }), '{"height":48}');
  assert.equal(encode(FieldEvent.Layout, { height: Number.NaN }), '{}');
  assert.equal(encode(FieldEvent.Layout, { height: PAN }), '{}');
});

test('wire: a tokenize result is the public result, with nothing beside it', () => {
  assert.deepEqual(
    tokenizeResult({ status: 'success', token: 'tok_123', card: { last4: '4242', expiryMonth: '12', expiryYear: '2030', cvc: CVC, number: PAN }, raw: { card_number: PAN } }),
    { status: 'success', token: 'tok_123', card: { last4: '4242', expiryMonth: '12', expiryYear: '2030' } }
  );
  assert.deepEqual(
    tokenizeResult({ status: 'validation_error', error: { code: 'validation_error', message: 'Enter a card number.', type: 'validation_error', stack: 'x' } }),
    { status: 'validation_error', error: { code: 'validation_error', message: 'Enter a card number.', type: 'validation_error' } }
  );
});

test('wire: a token is passed as it is, even one with a long run of digits inside', () => {
  const uuidLike = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(tokenizeResult({ status: 'success', token: uuidLike }).token, uuidLike);
});

test('wire: a success that cannot be passed on is unknown_outcome, never a plain failure', () => {
  for (const token of [PAN, '4242 4242 4242 4242', '', undefined, 'x'.repeat(2000)]) {
    const result = tokenizeResult({ status: 'success', token });
    assert.equal(result.status, 'error');
    assert.equal(result.error.code, 'unknown_outcome');
    assert.equal(result.error.message, NOT_PASSED_ON);
  }
});

test('wire: an error with an unknown code or no shape is still a well-formed refusal', () => {
  assert.deepEqual(tokenizeResult({ status: 'error', error: { code: 'weird', message: `no ${PAN}`, type: 'weird' } }), {
    status: 'error',
    error: { code: 'tokenization_failed', message: 'no [redacted]', type: 'api_error' },
  });
  assert.deepEqual(tokenizeResult(undefined), {
    status: 'error',
    error: { code: 'tokenization_failed', message: '', type: 'api_error' },
  });
});

test('wire: a command result that is too large still answers its command', () => {
  const huge = { commandId: 'c-1', name: 'tokenize', ok: true, result: { status: 'success', token: 'tok', card: {} }, message: 'm' };
  // Force the size limit by a circular value in a place encode() serialises.
  const circular = { commandId: 'c-2', name: 'tokenize', ok: true };
  circular.result = { status: 'success', token: 'tok_1', card: { last4: '4242' } };
  assert.equal(JSON.parse(encode(FormEvent.CommandResult, huge)).commandId, 'c-1');
  assert.deepEqual(JSON.parse(encode(FormEvent.CommandResult, { commandId: 'c-3', name: 'drop_table', ok: true })), { commandId: 'c-3', ok: true });
  assert.equal(JSON.parse(encode(FormEvent.CommandResult, circular)).result.token, 'tok_1');
  assert.equal(JSON.parse(encode(FormEvent.CommandResult, { commandId: `id ${PAN}`, ok: true })).commandId, undefined);
});

// ---- registry ----

const fakeForm = (overrides = {}) => ({
  calls: [],
  tokenize() { this.calls.push('tokenize'); return Promise.resolve({ status: 'success', token: 'tok_123' }); },
  reset() { this.calls.push('reset'); },
  focus(field) { this.calls.push(`focus:${field}`); },
  ...overrides,
});

test('registry: a form is found by its id until exactly its own close runs', () => {
  const form = fakeForm();
  let told = 0;
  const stop = subscribe(() => told++);
  const close = openForm('reg-1', form, 11);
  assert.equal(getForm('reg-1').form, form);
  assert.equal(getForm('reg-1').rootTag, 11);
  assert.equal(openForm('reg-1', fakeForm(), 12), null, 'a second root cannot take an open id');
  close();
  assert.equal(getForm('reg-1'), undefined);
  close();
  assert.equal(told, 2, 'field roots are told on open and on close, and not by the refused open or the second close');
  stop();
});

test('registry: a late close does not remove a newer form that reuses the id', () => {
  const closeFirst = openForm('reg-2', fakeForm(), 1);
  closeFirst();
  const second = fakeForm();
  const closeSecond = openForm('reg-2', second, 2);
  closeFirst();
  assert.equal(getForm('reg-2').form, second);
  closeSecond();
});

test('registry: a field is reachable while mounted, and a stale detach does not remove its successor', () => {
  const close = openForm('reg-3', fakeForm(), 1);
  const first = () => 'first';
  const second = () => 'second';
  const detachFirst = attachField('reg-3', 'cardCvc', first);
  attachField('reg-3', 'cardCvc', second);
  detachFirst();
  assert.equal(getForm('reg-3').fields.get('cardCvc')(), 'second');
  assert.equal(typeof attachField('no-such-form', 'cardCvc', first), 'function');
  close();
});

// ---- commands ----

test('commands: tokenize runs on the form; with no form it is the vault\'s own refusal', async () => {
  const form = fakeForm();
  const close = openForm('cmd-1', form, 1);
  assert.deepEqual(await run({ formId: 'cmd-1', name: 'tokenize' }, getForm), { ok: true, result: { status: 'success', token: 'tok_123' } });
  close();
  const refused = await run({ formId: 'cmd-1', name: 'tokenize' }, getForm);
  assert.equal(refused.ok, true);
  assert.equal(refused.result.status, 'validation_error');
  assert.equal(refused.result.error.code, 'incomplete_field_set');
});

test('commands: reset and focus go to the form; blur and clear go to the mounted field', async () => {
  const form = fakeForm();
  const close = openForm('cmd-2', form, 1);
  const field = { calls: [], blur() { this.calls.push('blur'); }, clear() { this.calls.push('clear'); } };
  attachField('cmd-2', 'cardNumber', () => field);
  assert.deepEqual(await run({ formId: 'cmd-2', name: 'reset' }, getForm), { ok: true });
  assert.deepEqual(await run({ formId: 'cmd-2', name: 'focus', elementType: 'cardCvc' }, getForm), { ok: true });
  assert.deepEqual(await run({ formId: 'cmd-2', name: 'clear', elementType: 'cardNumber' }, getForm), { ok: true });
  assert.deepEqual(await run({ formId: 'cmd-2', name: 'blur', elementType: 'cardNumber' }, getForm), { ok: true });
  assert.deepEqual(form.calls, ['reset', 'focus:cardCvc']);
  assert.deepEqual(field.calls, ['clear', 'blur']);
  assert.equal((await run({ formId: 'cmd-2', name: 'clear', elementType: 'cardCvc' }, getForm)).ok, false);
  assert.equal((await run({ formId: 'cmd-2', name: 'self_destruct' }, getForm)).ok, false);
  assert.equal((await run({ formId: 'nope', name: 'reset' }, getForm)).ok, false);
  close();
});

const fakeNative = () => {
  const native = {
    sent: [],
    listener: null,
    emitFormEvent: (rootTag, eventName, payload) => native.sent.push({ to: 'form', rootTag, eventName, payload: JSON.parse(payload) }),
    emitFieldEvent: (rootTag, eventName, payload) => native.sent.push({ to: 'field', rootTag, eventName, payload: JSON.parse(payload) }),
    onCommand: (listener) => { native.listener = listener; return { remove: () => { native.listener = null; } }; },
  };
  return native;
};
const settled = () => new Promise((resolve) => setTimeout(resolve, 5));

test('commands: every command is answered exactly once, to the form\'s root', async () => {
  const native = fakeNative();
  const stop = startCommands(makeBridge(native), getForm);
  const close = openForm('cmd-3', fakeForm(), 7);

  native.listener({ rootTag: 7, formId: 'cmd-3', commandId: 'a', name: 'tokenize' });
  native.listener({ rootTag: 7, formId: 'cmd-3', commandId: 'a', name: 'tokenize' });
  native.listener({ rootTag: 7, formId: 'nope', commandId: 'b', name: 'reset' });
  native.listener({ rootTag: 7, formId: 'cmd-3', commandId: 'c', name: 'self_destruct' });
  native.listener({ rootTag: 7, formId: 'cmd-3' });
  await settled();

  // Answers come back as each command finishes, so their order is not part of the contract.
  const answers = Object.fromEntries(native.sent.map((sent) => [sent.payload.commandId, sent.payload]));
  assert.equal(native.sent.length, 3, 'one answer each for a, b and c; none for the repeat or the id-less one');
  assert.deepEqual(Object.keys(answers).sort(), ['a', 'b', 'c']);
  assert.ok(native.sent.every((sent) => sent.to === 'form' && sent.rootTag === 7 && sent.eventName === FormEvent.CommandResult));
  assert.deepEqual(answers.a, { commandId: 'a', name: 'tokenize', ok: true, result: { status: 'success', token: 'tok_123' } });
  assert.equal(answers.b.ok, false);
  assert.equal(answers.c.ok, false);
  close();
  stop();
  assert.equal(native.listener, null);
});

test('commands: a form that throws, or whose tokenize rejects, still answers', async () => {
  const native = fakeNative();
  const stop = startCommands(makeBridge(native), getForm);
  const closeA = openForm('cmd-4', fakeForm({ reset() { throw new Error(`reset broke on ${PAN}`); } }), 1);
  const closeB = openForm('cmd-5', fakeForm({ tokenize: () => Promise.reject(new Error('network down')) }), 2);
  native.listener({ rootTag: 1, formId: 'cmd-4', commandId: 'x', name: 'reset' });
  native.listener({ rootTag: 2, formId: 'cmd-5', commandId: 'y', name: 'tokenize' });
  await settled();
  const answers = Object.fromEntries(native.sent.map((sent) => [sent.payload.commandId, sent.payload]));
  assert.equal(native.sent.length, 2);
  assert.deepEqual(answers.x, { commandId: 'x', name: 'reset', ok: false, message: 'reset broke on [redacted]' });
  assert.deepEqual(answers.y, { commandId: 'y', name: 'tokenize', ok: false, message: 'network down' });
  closeA();
  closeB();
  stop();
});

test('bridge: with no native module nothing is sent and nothing breaks', () => {
  const bridge = makeBridge(null);
  bridge.emitForm(1, FormEvent.Mounted, {});
  bridge.emitField(1, FieldEvent.Layout, { height: 10 });
  bridge.onCommand(() => {})();
});

test('bridge: only what the allow-list encodes reaches native code', () => {
  const native = fakeNative();
  const bridge = makeBridge(native);
  bridge.emitField(3, FieldEvent.Change, { elementType: 'cardNumber', empty: false, value: PAN });
  bridge.emitField(3, 'VAULT_FIELD_VALUE', { value: PAN });
  bridge.emitForm(undefined, FormEvent.Mounted, {});
  assert.deepEqual(native.sent, [{ to: 'field', rootTag: 3, eventName: FieldEvent.Change, payload: { elementType: 'cardNumber', empty: false } }]);
});
