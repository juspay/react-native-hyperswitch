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
 *     form.update({appearance});                       // every root re-renders; the card is kept
 *
 * WHERE THE CARD LIVES. In one VaultCardStore, created here and shared by the Host and every Field.
 * The handle below never exposes it: no store, no card values, only the card-free snapshot the
 * `change` event already carries. Unmounting the Host clears the store and makes tokenize() refuse.
 *
 * SAME FIELDS. The fields are the root entry's CardNumberField / CardExpiryField / CardCVCField /
 * CardholderNameField, unchanged; `Field` only gives them the widget context a <CardForm> would.
 *
 * SAME SETTINGS. `config` takes what <CardForm> takes as props, with the same defaults, and
 * `update()` is what a prop change is to a <CardForm>. The settings live in detachedSettings.mjs,
 * apart from the card.
 */
import * as React from 'react';
import { make as DetachedCardHostImpl } from './DetachedCardHost.bs.js';
import { make as DetachedCardFieldImpl } from './DetachedCardField.bs.js';
import { make as makeLink } from './DetachedCardLink.bs.js';
import { make as makeStore } from './VaultCardStore.bs.js';
import { tokenizeIncompleteFieldSet } from './VaultResult.bs.js';
import { makeSettings } from './detachedSettings.mjs';

const EVENTS = ['ready', 'change'];

const noHostMessage =
  'The card form has no Host mounted. Render <form.Host /> before calling tokenize().';

export function createDetachedCardForm(config = {}) {
  const store = makeStore();
  const link = makeLink();
  const settings = makeSettings(config);
  const listeners = { ready: new Set(), change: new Set() };
  let latest = null;

  const announce = (event, payload) => {
    if (event === 'change') latest = payload;
    const configured = settings.callbacks()[event === 'ready' ? 'onReady' : 'onChange'];
    if (typeof configured === 'function') configured(payload);
    for (const listener of listeners[event]) listener(payload);
  };
  /* Made once: a new function on every render would be a new prop on every render. */
  const onReady = (event) => announce('ready', event);
  const onChange = (event) => announce('change', event);

  /* Each root subscribes for itself: roots share no parent that could pass the settings down. */
  const useSettings = () =>
    React.useSyncExternalStore(settings.subscribe, settings.get, settings.get);

  const Host = () =>
    React.createElement(DetachedCardHostImpl, { ...useSettings(), store, link, onReady, onChange });
  Host.displayName = 'DetachedCardFormHost';

  const Field = ({ children }) =>
    React.createElement(DetachedCardFieldImpl, { ...useSettings(), store, link }, children);
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
    /* A <CardForm> prop change, for a form that has no props. Never touches the card. */
    update: (changes) => settings.update(changes),
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
