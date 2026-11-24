/*
 * What the merchant's engine sends to the vault's own engine: a form's settings and a field's
 * settings, as JSON text. Only data crosses. Callbacks stay here; the wrappers call them when the
 * matching event comes back.
 *
 * No React Native import: `flatten` (StyleSheet.flatten) is passed in, so this file can be tested
 * alone.
 */
import { SETTINGS } from '../detachedSettings.mjs';
import { FIELD_SETTINGS } from '../hosted/protocol.mjs';

/* undefined is dropped by JSON.stringify, which is what "not given" should be on the other side. */
const pick = (source, names) => {
  const out = {};
  for (const name of names) out[name] = source[name];
  return out;
};

/* Every data prop of <CardForm>, as the hosted form root reads it. */
export const formSettings = (props) => JSON.stringify(pick(props, SETTINGS));

/*
 * The keys of a field's `styles.root` that say where the field sits in the MERCHANT's layout. They
 * go on the native view, which is the thing in that layout. Everything else in `root` (padding,
 * background, border) describes the field's own box and goes inside with the other styles.
 */
const PLACEMENT = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'zIndex',
  'display',
]);

/*
 * A field's settings as JSON text, and the placement styles for its native view.
 * Styles are flattened to plain objects first: a registered or nested style cannot cross as it is.
 */
export function fieldOut(props, flatten) {
  const settings = pick(props, FIELD_SETTINGS);
  const placement = {};

  if (props.styles && typeof props.styles === 'object') {
    const styles = {};
    for (const part of Object.keys(props.styles)) styles[part] = flatten(props.styles[part]) ?? undefined;
    if (styles.root) {
      const inside = {};
      for (const key of Object.keys(styles.root)) {
        (PLACEMENT.has(key) ? placement : inside)[key] = styles.root[key];
      }
      styles.root = inside;
    }
    settings.styles = styles;
  }

  return { settings: JSON.stringify(settings), placement };
}

/* The text of an event or a result, read back. Never throws: unreadable text is an empty object. */
export function read(text) {
  try {
    const value = typeof text === 'string' ? JSON.parse(text) : null;
    return typeof value === 'object' && value !== null ? value : {};
  } catch {
    return {};
  }
}

const refusal = (message) => ({
  status: 'error',
  error: {
    code: 'tokenization_failed',
    message: typeof message === 'string' && message !== '' ? message : 'The card could not be tokenized.',
    type: 'api_error',
  },
});

/*
 * The answer to a tokenize command, as the vault's public result. The hosted bundle already shaped
 * `result`; a command that did not run at all (`ok: false`) becomes an ordinary refusal, so the
 * caller of tokenize() always gets a result and never an exception.
 */
export function tokenizeResultOf(text) {
  const answer = read(text);
  if (answer.ok === true && typeof answer.result === 'object' && answer.result !== null) return answer.result;
  return refusal(answer.message);
}
