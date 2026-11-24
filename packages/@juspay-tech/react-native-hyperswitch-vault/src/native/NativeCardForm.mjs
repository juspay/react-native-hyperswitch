/*
 * <CardForm> on the native path, in the MERCHANT's engine. It holds no card and renders no input:
 * it opens a form in the vault's own engine, tells its fields which form they belong to, and turns
 * the form's events and results back into the props and the handle a <CardForm> has always had.
 *
 * Same props, same events, same handle as the plain <CardForm> (src/CardForm.res). What differs is
 * where the work happens.
 */
import * as React from 'react';
import { FormEvent } from '../hosted/protocol.mjs';
import { formSettings, read, tokenizeResultOf } from './out.mjs';

/* Tells the fields below which form they are part of, and that they are on the native path. */
export const NativeFormContext = React.createContext(null);

let formCount = 0;
/* Unique for every mounted form in this engine, across reloads of a screen. */
const newFormId = () => `vault-form-${Date.now().toString(36)}-${(formCount += 1)}`;

export const NativeCardForm = React.forwardRef(function NativeCardForm(
  { forms, onGiveUp, children, ...props },
  ref
) {
  const formId = React.useRef(null);
  if (formId.current === null) formId.current = newFormId();
  const id = formId.current;

  const settings = formSettings(props);

  /* The newest callbacks, read when an event arrives: a new function prop re-opens nothing. */
  const callbacks = React.useRef(props);
  callbacks.current = props;
  const giveUp = React.useRef(onGiveUp);
  giveUp.current = onGiveUp;

  /* The settings the form was opened with, so the first run of the update effect sends nothing. */
  const sent = React.useRef(settings);

  React.useEffect(() => {
    let mounted = false;
    const subscription = forms.onFormEvent((event) => {
      if (event.formId !== id) return;
      const payload = read(event.payload);
      switch (event.name) {
        case FormEvent.Mounted:
          mounted = true;
          break;
        case FormEvent.Ready:
          callbacks.current.onReady?.(payload);
          break;
        case FormEvent.Change:
          callbacks.current.onChange?.(payload);
          break;
        case FormEvent.Error:
          /*
           * A form that never came up has no field on screen and nothing typed, so this form can
           * still be shown the plain way. After that it is too late to switch: a card may be in it.
           */
          if (!mounted) giveUp.current();
          break;
        default:
          break;
      }
    });
    /* Listening first, so no event of this form can be missed. */
    forms.openForm(id, sent.current);
    return () => {
      subscription.remove();
      forms.closeForm(id);
    };
  }, [forms, id]);

  React.useEffect(() => {
    if (settings === sent.current) return;
    sent.current = settings;
    forms.updateForm(id, settings);
  }, [forms, id, settings]);

  /* Set while this component commits, so a parent's first effect already finds it. */
  React.useImperativeHandle(
    ref,
    () => ({
      tokenize: () => forms.sendCommand(id, 'tokenize', '').then(tokenizeResultOf),
      reset: () => {
        forms.sendCommand(id, 'reset', '');
      },
      focus: (field) => {
        forms.sendCommand(id, 'focus', String(field));
      },
    }),
    [forms, id]
  );

  const context = React.useMemo(() => ({ forms, formId: id }), [forms, id]);
  return React.createElement(NativeFormContext.Provider, { value: context }, children);
});
