/*
 * Tells the MERCHANT's React Native that a card field has the keyboard.
 *
 * React Native keeps one record of "the text input that is focused now". Two things the merchant
 * relies on read it: a ScrollView closing the keyboard when the user taps outside a field, and
 * Keyboard.dismiss(). On the native path the real input is in the vault's own engine, so this
 * engine's record would stay empty and both would do nothing: the keyboard would stay open.
 *
 * So the native field view stands in for the input in that record. When React Native then asks it
 * to blur, the request reaches the native view as the same "blur" command a text input gets, and
 * the view passes it on to the real field.
 *
 * The record is React Native's own file, reached by path, and required only when a native field
 * first uses it (see fieldView.mjs for why nothing is imported at the top). Everything here checks
 * that a function exists before calling it and never throws: without it the fields still work, and
 * only the closing of the keyboard from outside is lost.
 */

let state;

const stateOf = () => {
  if (state === undefined) {
    try {
      const module = require('react-native/Libraries/Components/TextInput/TextInputState');
      /* The file is an ES module in newer React Native and CommonJS in older ones. */
      state = module && typeof module.default === 'object' ? module.default : module;
    } catch {
      state = null;
    }
  }
  return state;
};

const call = (name, view) => {
  try {
    const record = view != null ? stateOf() : null;
    if (record && typeof record[name] === 'function') record[name](view);
  } catch {
    /* A changed internal must not break a card form. */
  }
};

/* While the field is mounted: this view counts as a text input. */
export const register = (view) => call('registerInput', view);
export const unregister = (view) => call('unregisterInput', view);

/* The field inside gained or lost the keyboard. */
export const focused = (view) => call('focusInput', view);
export const blurred = (view) => call('blurInput', view);
