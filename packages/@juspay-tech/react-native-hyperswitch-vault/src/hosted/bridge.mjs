/*
 * The bundle's side of the native module. Everything outgoing goes through wire.encode(), so no
 * caller in this folder can send a value the allow-list does not know. Payloads cross as JSON text:
 * one string is the same on every React Native version, where a typed object is not.
 *
 * `native` is the HyperswitchVaultHosted module, or null where it does not exist (tests, or a
 * bundle loaded by something other than the vault's own host). With null nothing is sent and no
 * command arrives: the roots still render.
 */
import { encode } from './wire.mjs';

export function makeBridge(native) {
  const send = (method) => (rootTag, eventName, payload) => {
    if (!native || typeof rootTag !== 'number') return;
    const text = encode(eventName, payload);
    if (text !== null) native[method](rootTag, eventName, text);
  };

  return {
    emitForm: send('emitFormEvent'),
    emitField: send('emitFieldEvent'),
    /* Native sends {rootTag, formId, commandId, name, elementType?}. Returns the unsubscribe function. */
    onCommand(listener) {
      const subscription = native?.onCommand?.(listener);
      return () => subscription?.remove?.();
    },
  };
}
