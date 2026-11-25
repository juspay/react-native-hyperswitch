/*
 * What the package root exports as CardForm and the four fields: components that pick, when they
 * render, between the native path and the plain JavaScript one.
 *
 *   CardForm        native when availability.mjs says the native path can run here, else plain.
 *                   A native form that fails to come up switches itself to plain, once.
 *   the fields      native inside a native form, plain inside a plain one. A field never decides
 *                   for itself: its form already has.
 *
 * Either way the merchant gets the same props, the same events and the same handles. The form's
 * handle is ONE object for the life of the form, even across a switch to plain (handle.mjs).
 *
 * NO ROOT EXPORT REACHES AN IMPLEMENTATION EXCEPT THROUGH HERE. A component bound straight to its
 * plain implementation would stay on the plain path in an app where the native one is available,
 * and nothing would show it.
 */
import * as React from 'react';
import { make as PlainCardForm } from '../CardForm.bs.js';
import { make as PlainCardNumberField } from '../CardNumberField.bs.js';
import { make as PlainCardExpiryField } from '../CardExpiryField.bs.js';
import { make as PlainCardCVCField } from '../CardCVCField.bs.js';
import { make as PlainCardholderNameField } from '../CardholderNameField.bs.js';
import { nativeForms } from './availability.mjs';
import { forwardingHandle } from './handle.mjs';
import { NativeCardForm, NativeFormContext } from './NativeCardForm.mjs';
import { NativeField } from './NativeField.mjs';

export const CardForm = React.forwardRef(function CardForm(props, ref) {
  const forms = nativeForms();
  const [gaveUp, setGaveUp] = React.useState(false);
  const onGiveUp = React.useCallback(() => setGaveUp(true), []);

  /* The form mounted now, and the one handle the caller gets for it (handle.mjs). */
  const inner = React.useRef(null);
  React.useImperativeHandle(ref, () => forwardingHandle(() => inner.current), []);

  if (forms === null || gaveUp) {
    /* Provider with null: fields under a plain form are plain even inside some outer native form. */
    return React.createElement(
      NativeFormContext.Provider,
      { value: null },
      React.createElement(PlainCardForm, { ...props, ref: inner })
    );
  }
  return React.createElement(NativeCardForm, { ...props, ref: inner, forms, onGiveUp });
});
CardForm.displayName = 'CardForm';

const field = (elementType, Plain, displayName) => {
  const Field = React.forwardRef(function Field(props, ref) {
    const context = React.useContext(NativeFormContext);
    return context === null
      ? React.createElement(Plain, { ...props, ref })
      : React.createElement(NativeField, { ...props, ref, context, elementType });
  });
  Field.displayName = displayName;
  return Field;
};

export const CardNumberField = field('cardNumber', PlainCardNumberField, 'CardNumberField');
export const CardExpiryField = field('cardExpiry', PlainCardExpiryField, 'CardExpiryField');
export const CardCVCField = field('cardCvc', PlainCardCVCField, 'CardCVCField');
export const CardholderNameField = field('cardholderName', PlainCardholderNameField, 'CardholderNameField');
