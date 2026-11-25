/*
 * What may leave the hosted engine. Everything this bundle sends to native code passes through
 * encode(), and encode() copies only the keys listed here, each through a rule for its kind of
 * value. A key that is not listed, or a value that breaks its rule, is left out.
 *
 * The lists are the vault's PUBLIC shapes (src/public.ts): what a merchant's onChange and
 * tokenize() already receive from a <CardForm>. So the card number and the CVC cannot leave, by
 * construction: no rule below can carry them. The longest run of digits a rule lets through is the
 * 8 of `extendedBin`.
 *
 * Text written by people (error messages) is the one free-form kind. It has card-number shapes
 * blanked by the logger's own redactDigits and is cut to MAX_TEXT.
 */
import { redactDigits } from '../VaultLogger.bs.js';
import { COMMANDS, ELEMENT_TYPES, FieldEvent, FormEvent } from './protocol.mjs';

export const MAX_TEXT = 512;
export const MAX_TOKEN = 1024;
export const MAX_PAYLOAD = 64 * 1024;
export const NOT_PASSED_ON = 'The result could not be passed on.';

const LEAVE_OUT = Symbol('leave out');

/* ---- rules: each takes a value and returns it, a cleaned copy, or LEAVE_OUT ---- */

const flag = (value) => (typeof value === 'boolean' ? value : LEAVE_OUT);
const oneOf = (allowed) => (value) => (allowed.includes(value) ? value : LEAVE_OUT);
const text = (value) =>
  typeof value === 'string' ? redactDigits(value).slice(0, MAX_TEXT) : LEAVE_OUT;
/* A brand or network name: letters and spaces only, so it cannot carry digits. */
const name = (value) =>
  typeof value === 'string' && /^[A-Za-z ]{0,32}$/.test(value) ? value : LEAVE_OUT;
/* A value the public shape allows to be null. */
const orNull = (rule) => (value) => (value === null || value === undefined ? null : rule(value));
const digits = (most) => (value) =>
  typeof value === 'string' && value.length <= most && /^\d*$/.test(value) ? value : LEAVE_OUT;
/* "12 / 30": digits, spaces and one slash. */
const expiryText = (value) =>
  typeof value === 'string' && /^[\d\s/]{0,9}$/.test(value) ? value : LEAVE_OUT;
const shape = (rules) => (value) => (isRecord(value) ? pick(value, rules) : LEAVE_OUT);

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/* Copies the listed keys that are present and pass their rule. Nothing else. */
function pick(source, rules) {
  const out = {};
  for (const key of Object.keys(rules)) {
    if (!(key in source)) continue;
    const value = rules[key](source[key]);
    if (value !== LEAVE_OUT) out[key] = value;
  }
  return out;
}

/* ---- the public shapes ---- */

const FIELD_ERROR_CODES = [
  'required',
  'invalid_card_number',
  'invalid_expiry',
  'invalid_cvc',
  'unsupported_network',
];
const ELIGIBILITY = ['unknown', 'pending', 'allowed', 'denied'];
const SESSION_STATUS = ['valid', 'invalid', 'absent', 'expired', 'consumed'];
const ERROR_CODES = [
  'validation_error',
  'incomplete_field_set',
  'session_expired',
  'session_consumed',
  'confirm_in_progress',
  'tokenization_failed',
  'invalid_session',
  'unsupported_configuration',
  'unknown_outcome',
];
const ERROR_TYPES = ['validation_error', 'api_error', 'card_error'];

const elementType = oneOf(ELEMENT_TYPES);

/* VaultFieldChange (and the `eligibility` the field sends beside it today). */
const FIELD_CHANGE = {
  elementType,
  empty: flag,
  complete: flag,
  valid: flag,
  brand: name,
  error: text,
  errorCode: oneOf(FIELD_ERROR_CODES),
  touched: flag,
  isCoBadged: flag,
  eligibility: oneOf(ELIGIBILITY),
};

/* VaultCardDetails: the card summary a merchant already receives. */
const CARD_DETAILS = {
  bin: orNull(digits(6)),
  extendedBin: orNull(digits(8)),
  last4: orNull(digits(4)),
  brand: orNull(name),
  expiryMonth: orNull(digits(2)),
  expiryYear: orNull(digits(4)),
  formattedExpiry: orNull(expiryText),
  isCardNumberComplete: flag,
  isCvcComplete: flag,
  isExpiryComplete: flag,
  isCardNumberValid: flag,
  isExpiryValid: flag,
};

/* VaultCardFormChange. */
const FORM_CHANGE = {
  elementType: oneOf(['cardForm']),
  eventName: oneOf(['cardDetailsChange']),
  payload: shape(CARD_DETAILS),
  fieldsReady: flag,
  sessionStatus: oneOf(SESSION_STATUS),
  complete: flag,
  valid: flag,
  submitting: flag,
  canSubmit: flag,
  isCoBadged: flag,
  eligibility: oneOf(ELIGIBILITY),
  networkError: shape({ code: oneOf(FIELD_ERROR_CODES), message: text }),
  fields: shape({
    cardNumber: shape(FIELD_CHANGE),
    cardExpiry: shape(FIELD_CHANGE),
    cardCvc: shape(FIELD_CHANGE),
    cardholderName: shape(FIELD_CHANGE),
  }),
};

/* VaultTokenizedCard. */
const TOKENIZED_CARD = {
  bin: digits(8),
  last4: digits(4),
  brand: name,
  expiryMonth: digits(2),
  expiryYear: digits(4),
};

/*
 * A token is the vault's own value and is not text to clean: blanking digits inside it would
 * corrupt it. It is refused only when it is not a token at all: empty, too long, or nothing but
 * the digits and separators of a card number.
 */
const isToken = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_TOKEN &&
  !/^\d(?:[\s./-]*\d){11,}$/.test(value);

/*
 * VaultTokenizeResult. A success whose token cannot be passed on becomes `unknown_outcome`: the
 * vault may have saved the card, and the merchant must not be told it failed for sure.
 */
export function tokenizeResult(result) {
  if (isRecord(result) && result.status === 'success') {
    if (!isToken(result.token)) {
      return { status: 'error', error: errorOf({ code: 'unknown_outcome', message: NOT_PASSED_ON }) };
    }
    const out = { status: 'success', token: result.token };
    if (isRecord(result.card)) out.card = pick(result.card, TOKENIZED_CARD);
    return out;
  }
  const status = isRecord(result) && result.status === 'validation_error' ? 'validation_error' : 'error';
  return { status, error: errorOf(isRecord(result) ? result.error : undefined, status) };
}

function errorOf(error, status = 'error') {
  const given = isRecord(error) ? error : {};
  const fallbackType = status === 'validation_error' ? 'validation_error' : 'api_error';
  return {
    code: ERROR_CODES.includes(given.code) ? given.code : 'tokenization_failed',
    message: typeof given.message === 'string' ? redactDigits(given.message).slice(0, MAX_TEXT) : '',
    type: ERROR_TYPES.includes(given.type) ? given.type : fallbackType,
  };
}

const commandId = (value) =>
  typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : LEAVE_OUT;
const height = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000
    ? Math.ceil(value)
    : LEAVE_OUT;

const ONLY_ELEMENT = { elementType };

/* Every event this bundle may send, with the keys it may carry. */
const EVENTS = {
  [FormEvent.Mounted]: {},
  [FormEvent.Ready]: { elementType: oneOf(['cardForm']) },
  [FormEvent.Change]: FORM_CHANGE,
  [FormEvent.Error]: { message: text },
  [FormEvent.CommandResult]: {
    commandId,
    name: oneOf(COMMANDS),
    ok: flag,
    message: text,
    result: (value) => tokenizeResult(value),
  },
  [FieldEvent.Ready]: ONLY_ELEMENT,
  [FieldEvent.Focus]: ONLY_ELEMENT,
  [FieldEvent.Blur]: ONLY_ELEMENT,
  [FieldEvent.Change]: FIELD_CHANGE,
  [FieldEvent.Layout]: { height },
  [FieldEvent.Error]: { elementType, message: text },
};

/* The cleaned payload of an event, or null for an event this bundle does not send. */
export function payloadOf(eventName, payload) {
  const rules = EVENTS[eventName];
  if (!rules) return null;
  return pick(isRecord(payload) ? payload : {}, rules);
}

/*
 * The JSON text native code receives, or null when nothing may be sent. A command's answer is
 * never dropped: one that is too large, or cannot be written as JSON, is replaced by a refusal that
 * still carries its commandId, so the caller's promise settles.
 */
export function encode(eventName, payload) {
  const cleaned = payloadOf(eventName, payload);
  if (cleaned === null) return null;
  let encoded = null;
  try {
    encoded = JSON.stringify(cleaned);
  } catch {
    encoded = null;
  }
  if (encoded !== null && encoded.length <= MAX_PAYLOAD) return encoded;
  if (eventName !== FormEvent.CommandResult) return null;
  return JSON.stringify(
    pick({ ...cleaned, ok: false, message: NOT_PASSED_ON }, { commandId, name: oneOf(COMMANDS), ok: flag, message: text })
  );
}
