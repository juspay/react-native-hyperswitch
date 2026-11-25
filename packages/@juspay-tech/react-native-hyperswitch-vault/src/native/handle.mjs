/*
 * The one handle a <CardForm> gives its ref, whichever implementation is mounted under it.
 *
 * WHY ONE. A native form that fails to come up switches itself to the plain fields, and React then
 * gives an inner ref a new object. A caller that kept the first object would keep calling a form
 * that is gone, and every tokenize() would be refused. The payment-methods SDK does exactly that: it
 * reads the vault's ref once, in its first effect. So the caller gets this object instead. It never
 * changes, and each call goes to the form that is mounted at that moment.
 *
 * With no form mounted, the calls refuse the way createCardForm's handle does, and never throw.
 */
import {
  incompleteFieldSetMessage,
  tokenizeIncompleteFieldSet,
  unsupportedConfiguration,
} from '../VaultResult.bs.js';

/* `current` returns the handle of the form mounted now, or null. */
export function forwardingHandle(current) {
  return {
    tokenize: () => {
      const form = current();
      return form ? form.tokenize() : Promise.resolve(tokenizeIncompleteFieldSet(incompleteFieldSetMessage));
    },
    /* The plain form has it (the checkout SDK pays through ./host); the native form does not. */
    confirmPayment: (input) => {
      const form = current();
      return form && typeof form.confirmPayment === 'function'
        ? form.confirmPayment(input)
        : Promise.resolve(unsupportedConfiguration());
    },
    reset: () => {
      current()?.reset();
    },
    focus: (field) => {
      current()?.focus(field);
    },
  };
}
