/*
 * The contract between the vault's JavaScript and the native code that hosts it. Two pieces of
 * JavaScript read this file: the hosted bundle (src/hosted, in the vault's own engine) and the
 * wrappers in the merchant's engine (src/native). The native side (android/, ios/) keeps its own
 * copy of the names. PROTOCOL_VERSION is how the three notice they have drifted: the bundle is
 * built into the app, while the wrappers can arrive later in an over-the-air update.
 *
 * "Hosted" means: JavaScript that runs in an engine the vault's native code started, not in the
 * merchant's. This file holds names only, so the merchant's engine loading it loads no field code.
 */
export const PROTOCOL_VERSION = 1;

/* The native module the hosted bundle talks to. It exists only in the vault's own engine. */
export const NATIVE_MODULE = 'HyperswitchVaultHosted';

/* The native module and the native view the merchant's engine uses. */
export const FORMS_MODULE = 'HyperswitchVaultForms';
export const FIELD_VIEW = 'HyperswitchVaultFieldView';

/*
 * The React Native minor versions the bundle has been run on. Outside this range the fields render
 * in plain JavaScript, as they did before there was a native path. Widen it only with a test run.
 */
export const TESTED_REACT_NATIVE = { from: 82, to: 88 };

/* The field props that are data, and so can cross to the other engine. Callbacks stay behind. */
export const FIELD_SETTINGS = [
  'styles',
  'placeholder',
  'label',
  'labelBehavior',
  'errorDisplay',
  'unstyled',
  'accessibilityLabel',
  'accessibilityHint',
  'testID',
  'cardBrandIcon',
  'cvcIcon',
  'options',
];

/* The roots the native side starts by name. One hidden FORM_ROOT per form; one FIELD_ROOT per field. */
export const FORM_ROOT = 'HyperswitchVaultForm';
export const FIELD_ROOT = 'HyperswitchVaultField';

/* Set by the entry file, so the vault's own components know they are already inside an SDK engine. */
export const SDK_ENGINE_FLAG = '__HYPERSWITCH_SDK_ENGINE__';

export const ELEMENT_TYPES = ['cardNumber', 'cardExpiry', 'cardCvc', 'cardholderName'];

export const FormEvent = {
  /* The hidden root is up and commands can run. Not the merchant's onReady. */
  Mounted: 'VAULT_FORM_MOUNTED',
  /* <CardForm>'s onReady, as the vault fires it today. */
  Ready: 'VAULT_FORM_READY',
  Change: 'VAULT_FORM_CHANGE',
  Error: 'VAULT_FORM_ERROR',
  CommandResult: 'VAULT_COMMAND_RESULT',
};

export const FieldEvent = {
  Ready: 'VAULT_FIELD_READY',
  Change: 'VAULT_FIELD_CHANGE',
  Focus: 'VAULT_FIELD_FOCUS',
  Blur: 'VAULT_FIELD_BLUR',
  Layout: 'VAULT_FIELD_LAYOUT',
  Error: 'VAULT_FIELD_ERROR',
};

/* tokenize and reset act on the form; focus, blur and clear act on one field. */
export const FORM_COMMANDS = ['tokenize', 'reset'];
export const FIELD_COMMANDS = ['focus', 'blur', 'clear'];
export const COMMANDS = [...FORM_COMMANDS, ...FIELD_COMMANDS];
