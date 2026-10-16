/*
 * `createDetachedCardForm(config)` — a card form whose fields are NOT its children. Each field may
 * sit in a React root of its own (one native view per field, the way a hosted checkout lays them
 * out), and the form still collects and tokenizes one card.
 *
 *     const form = createDetachedCardForm({vaultDetails, environment: 'sandbox', onChange});
 *
 *     <form.Host />                                    // once, in the screen that owns the form
 *     <form.Field><CardNumberField /></form.Field>     // in its own root
 *     <form.Field><CardExpiryField /></form.Field>     // in its own root
 *     <form.Field><CardCVCField /></form.Field>        // in its own root
 *
 *     const result = await form.tokenize();
 *
 * WHERE THE CARD LIVES. In one VaultCardStore, created here and shared by the Host and every Field.
 * The handle below never exposes it: no store, no card values, only the card-free snapshot the
 * `change` event already carries. Unmounting the Host clears the store and makes tokenize() refuse.
 *
 * SAME FIELDS. The fields are the root entry's CardNumberField / CardExpiryField / CardCVCField /
 * CardholderNameField, unchanged; `Field` only gives them the widget context a <CardForm> would.
 */
import * as React from 'react';
import { make as DetachedCardHostImpl } from './DetachedCardHost.bs.js';
import { make as DetachedCardFieldImpl } from './DetachedCardField.bs.js';
import { make as makeLink } from './DetachedCardLink.bs.js';
import { make as makeStore } from './VaultCardStore.bs.js';
import { tokenizeIncompleteFieldSet } from './VaultResult.bs.js';

const EVENTS = ['ready', 'change'];

const noHostMessage =
  'The card form has no Host mounted. Render <form.Host /> before calling tokenize().';

/*
 * Callers pass the web's lowercase names ('sandbox') as well as the vault's ('SANDBOX'). The form
 * then reads the name exactly as <CardForm> does (VaultConfirm.normalizeEnvironment).
 */
const environmentOf = (value) => (typeof value === 'string' ? value.toUpperCase() : 'PROD');

export function createDetachedCardForm(config = {}) {
  const store = makeStore();
  const link = makeLink();
  const listeners = { ready: new Set(), change: new Set() };
  let latest = null;

  const announce = (event, payload) => {
    if (event === 'change') latest = payload;
    const configured = config[event === 'ready' ? 'onReady' : 'onChange'];
    if (typeof configured === 'function') configured(payload);
    for (const listener of listeners[event]) listener(payload);
  };

  const shared = {
    store,
    link,
    sdkAuthorization: config.sdkAuthorization,
    vaultDetails: config.vaultDetails,
    environment: environmentOf(config.environment),
    appearance: config.appearance,
    locale: config.locale,
    customEndpoints: config.customEndpoints,
  };

  const Host = () =>
    React.createElement(DetachedCardHostImpl, {
      ...shared,
      onReady: (event) => announce('ready', event),
      onChange: (event) => announce('change', event),
    });
  Host.displayName = 'DetachedCardFormHost';

  const Field = ({ children }) => React.createElement(DetachedCardFieldImpl, shared, children);
  Field.displayName = 'DetachedCardFormField';

  return {
    Host,
    Field,
    /* The only route to a token. Refuses, never throws, when no Host is mounted. */
    tokenize: () =>
      link.machinery
        ? link.machinery.tokenize()
        : Promise.resolve(tokenizeIncompleteFieldSet(noHostMessage)),
    reset: () => {
      if (link.machinery) link.machinery.reset();
    },
    focus: (field) => {
      if (link.focusField) link.focusField(field);
    },
    /* The last card-free snapshot, or null before the form has emitted. */
    getState: () => latest,
    on: (event, listener) => {
      if (!EVENTS.includes(event)) {
        throw new Error(
          `createDetachedCardForm: unknown event "${event}"; expected one of ${EVENTS.join(', ')}.`
        );
      }
      listeners[event].add(listener);
      return () => listeners[event].delete(listener);
    },
  };
}
