/*
 * `createCardForm(config)` — the imperative spelling of <CardForm>, shaped like the web SDK's
 * `paymentMethodsSession(...).cardForm()` object: build the form first, hold it in a plain variable,
 * subscribe with `on(event, cb)`, and drive it with method calls.
 *
 *     const cardForm = createCardForm({session, environment: 'sandbox'});
 *     cardForm.on('change', (e) => setEnabled(e.canSubmit));
 *
 *     <cardForm.Form>
 *       <CardNumberField />
 *       <CardExpiryField />
 *       <CardCVCField />
 *     </cardForm.Form>
 *
 *     const result = await cardForm.tokenize();
 *
 * WHAT IT IS NOT. This is a HANDLE, not a store. The card state still lives inside the mounted
 * component, exactly as it does for a merchant using a ref — that is what keeps the PAN inside
 * library-owned React state and off this object. So:
 *
 *   - the fields must still be rendered inside `cardForm.Form`; nothing is collected before that;
 *   - `tokenize()` before the form mounts resolves to `incomplete_field_set` rather than throwing,
 *     matching every other refusal on this surface;
 *   - `getState()` is `null` until the first `change` arrives.
 *
 * One instance drives ONE mounted form. Rendering `Form` twice points the handle at whichever
 * mounted last, so create one instance per form.
 */
import * as React from 'react';
import { make as CardFormImpl } from './CardForm.bs.js';
import { tokenizeIncompleteFieldSet, incompleteFieldSetMessage } from './VaultResult.bs.js';

const EVENTS = ['ready', 'change'];

export function createCardForm(config = {}) {
  const ref = React.createRef();
  const listeners = { ready: new Set(), change: new Set() };
  let latest = null;

  /*
   * An event is fanned out to the config callback, the render-time callback and every `on()`
   * listener, in that order, so a caller can subscribe imperatively AND still pass callbacks as
   * props.
   */
  const announce = (event, payload, fromRender) => {
    if (event === 'change') latest = payload;
    const configured = config[event === 'ready' ? 'onReady' : 'onChange'];
    if (typeof configured === 'function') configured(payload);
    if (typeof fromRender === 'function') fromRender(payload);
    for (const listener of listeners[event]) listener(payload);
  };

  /*
   * Props given at render override the ones given at construction, so a caller can build the form
   * once and still vary presentation per render. `children` is never taken from the config.
   */
  const Form = ({ children, onReady: readyFromRender, onChange: changeFromRender, ...overrides }) =>
    React.createElement(
      CardFormImpl,
      {
        ...config,
        ...overrides,
        ref,
        /*
         * Pulled out of `overrides` deliberately: these wrappers have to BE the component's
         * callbacks so the instance can keep `latest` and feed subscribers.
         */
        onReady: (event) => announce('ready', event, readyFromRender),
        onChange: (event) => announce('change', event, changeFromRender),
      },
      children
    );
  Form.displayName = 'CardForm';

  return {
    Form,
    /* The only route to a token. Refuses, never throws, when nothing is mounted.
     * `paymentMethodData` (e.g. { nickName }) is forwarded to the confirm call. */
    tokenize: (paymentMethodData) =>
      ref.current
        ? ref.current.tokenize(paymentMethodData)
        : Promise.resolve(tokenizeIncompleteFieldSet(incompleteFieldSetMessage)),
    reset: () => {
      if (ref.current) ref.current.reset();
    },
    focus: (field) => {
      if (ref.current) ref.current.focus(field);
    },
    /* The last card-free snapshot, or null before the form has emitted. */
    getState: () => latest,
    /*
     * The web's `cardForm.on(event, cb)`. Unlike the web, more than one listener per event is kept;
     * the returned function removes this one.
     */
    on: (event, listener) => {
      if (!EVENTS.includes(event)) {
        throw new Error(`createCardForm: unknown event "${event}"; expected one of ${EVENTS.join(', ')}.`);
      }
      listeners[event].add(listener);
      return () => listeners[event].delete(listener);
    },
  };
}
