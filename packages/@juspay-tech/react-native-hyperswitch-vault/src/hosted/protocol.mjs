/*
 * The contract between the vault's hosted bundle and the native code that hosts it. The native side
 * (android/, ios/) and the merchant-side wrappers keep their own copy of these names;
 * PROTOCOL_VERSION is how the three notice they have drifted. Every name is listed here and nowhere
 * else in the bundle.
 *
 * "Hosted" means: this JavaScript runs in an engine the vault's native code started, not in the
 * merchant's. The merchant's engine never loads this folder.
 */
export const PROTOCOL_VERSION = 1;

/* The native module this bundle talks to. */
export const NATIVE_MODULE = 'HyperswitchVaultHosted';

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
