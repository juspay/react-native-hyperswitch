/*
 * The two React roots the native host starts in this engine.
 *
 *   FormRoot   one per form, never shown. It creates the detached card form, registers it under
 *              its formId and renders the form's Host, which owns tokenize().
 *   FieldRoot  one per field, shown inside the native field view. It finds its form by formId and
 *              renders the vault's own field inside the form's Field, so every field of a form
 *              edits one card.
 *
 * WHAT NATIVE PASSES. Flat props, the same on start and on every update:
 *   FormRoot   { formId, protocolVersion, settings }               settings: JSON text
 *   FieldRoot  { formId, elementType, protocolVersion, settings }  settings: JSON text
 * React Native adds `rootTag`, which is how native code finds the root's owner again when an event
 * comes back. Settings are text so that "did they change?" is a string comparison.
 *
 * THE FIELDS ARE THE PLAIN ONES. They are imported from their implementation files, never from the
 * package root: the root's components may choose to render a native view, and inside this engine
 * that would start a second host from within the first.
 */
import * as React from 'react';
import { View } from 'react-native';
import { make as CardNumberField } from '../CardNumberField.bs.js';
import { make as CardExpiryField } from '../CardExpiryField.bs.js';
import { make as CardCVCField } from '../CardCVCField.bs.js';
import { make as CardholderNameField } from '../CardholderNameField.bs.js';
import { createDetachedCardForm } from '../createDetachedCardForm.mjs';
import { SETTINGS } from '../detachedSettings.mjs';
import { attachField, getForm, openForm, subscribe } from './forms.mjs';
import { ELEMENT_TYPES, FIELD_SETTINGS, FieldEvent, FormEvent, PROTOCOL_VERSION } from './protocol.mjs';

const FIELDS = {
  cardNumber: CardNumberField,
  cardExpiry: CardExpiryField,
  cardCvc: CardCVCField,
  cardholderName: CardholderNameField,
};

/*
 * The listed keys of a JSON object, or null when the text is not one. EVERY listed key is present
 * in the result, `undefined` when native did not send it: handed to update(), that returns a
 * setting the merchant removed to its default.
 */
function readSettings(text, names) {
  let parsed;
  try {
    parsed = typeof text === 'string' && text !== '' ? JSON.parse(text) : {};
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const out = {};
  for (const name of names) out[name] = parsed[name];
  return out;
}

const messageOf = (error) => (error instanceof Error ? error.message : 'The card form failed.');

/* A crash inside a root has nowhere to go in this engine, so it is reported and the root draws nothing. */
class RootBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error) {
    this.props.onCrash(messageOf(error));
  }
  render() {
    return this.state.crashed ? null : this.props.children;
  }
}

/* Reports `problem` once and draws nothing. */
function Refused({ problem, report }) {
  React.useEffect(() => report(problem), [problem, report]);
  return null;
}

const problemOf = (formId, protocolVersion) => {
  if (protocolVersion !== PROTOCOL_VERSION) {
    return `This card form speaks protocol ${PROTOCOL_VERSION}; its host asked for ${String(protocolVersion)}.`;
  }
  return typeof formId === 'string' && formId !== '' ? null : 'The card form was started without a formId.';
};

export function makeRoots(bridge) {
  function OpenForm({ rootTag, formId, initial, settings }) {
    /* One detached form for the life of this root. The first settings create it; later ones update it. */
    const formRef = React.useRef(null);
    if (formRef.current === null) formRef.current = createDetachedCardForm(initial);
    const form = formRef.current;
    const [duplicate, setDuplicate] = React.useState(false);

    React.useEffect(() => {
      const close = openForm(formId, form, rootTag);
      if (close === null) {
        setDuplicate(true);
        bridge.emitForm(rootTag, FormEvent.Error, { message: `Card form "${formId}" is already open.` });
        return undefined;
      }
      const offReady = form.on('ready', (event) => bridge.emitForm(rootTag, FormEvent.Ready, event));
      const offChange = form.on('change', (event) => bridge.emitForm(rootTag, FormEvent.Change, event));
      /* The Host below ran its effects before this one, so tokenize() can already reach it. */
      bridge.emitForm(rootTag, FormEvent.Mounted, {});
      return () => {
        offReady();
        offChange();
        close();
      };
    }, [form, formId, rootTag]);

    /* A prop update from native. Equal settings change nothing; the card is never touched. */
    React.useEffect(() => form.update(settings), [form, settings]);

    return duplicate ? null : React.createElement(form.Host);
  }

  function FormRoot({ rootTag, formId, protocolVersion, settings }) {
    const parsed = React.useMemo(() => readSettings(settings, SETTINGS), [settings]);
    const report = React.useCallback(
      (message) => bridge.emitForm(rootTag, FormEvent.Error, { message }),
      [rootTag]
    );
    const problem =
      problemOf(formId, protocolVersion) ?? (parsed === null ? 'The card form\'s settings could not be read.' : null);
    if (problem !== null) return React.createElement(Refused, { problem, report });
    return React.createElement(
      RootBoundary,
      { onCrash: report },
      /* `key`: a root given another formId is another form, with a card of its own. */
      React.createElement(OpenForm, { key: formId, rootTag, formId, initial: parsed, settings: parsed })
    );
  }

  function ShownField({ rootTag, formId, elementType, settings }) {
    /* Undefined until the form's root has registered it, and again once that root has gone. */
    const read = () => getForm(formId);
    const entry = React.useSyncExternalStore(subscribe, read, read);
    const handle = React.useRef(null);
    const lastHeight = React.useRef(-1);

    const sendHeight = React.useCallback(
      (height) => {
        const rounded = Math.ceil(height);
        if (rounded === lastHeight.current) return;
        lastHeight.current = rounded;
        bridge.emitField(rootTag, FieldEvent.Layout, { height: rounded });
      },
      [rootTag]
    );

    React.useEffect(() => {
      if (!entry) {
        /* The form closed under a field that had drawn: its native view must collapse too. */
        if (lastHeight.current > 0) sendHeight(0);
        return undefined;
      }
      return attachField(formId, elementType, () => handle.current);
    }, [entry, formId, elementType, sendHeight]);

    const onLayout = React.useCallback((event) => sendHeight(event.nativeEvent.layout.height), [sendHeight]);
    const send = React.useMemo(
      () => ({
        onReady: (event) => bridge.emitField(rootTag, FieldEvent.Ready, event),
        onFocus: (event) => bridge.emitField(rootTag, FieldEvent.Focus, event),
        onBlur: (event) => bridge.emitField(rootTag, FieldEvent.Blur, event),
        onChange: (event) => bridge.emitField(rootTag, FieldEvent.Change, event),
      }),
      [rootTag]
    );

    if (!entry) return null;
    return React.createElement(
      /* The field's height is its content's: the native view sizes itself from VAULT_FIELD_LAYOUT. */
      View,
      { onLayout, collapsable: false },
      React.createElement(
        entry.form.Field,
        null,
        React.createElement(FIELDS[elementType], { ...settings, ...send, ref: handle })
      )
    );
  }

  function FieldRoot({ rootTag, formId, elementType, protocolVersion, settings }) {
    const parsed = React.useMemo(() => readSettings(settings, FIELD_SETTINGS), [settings]);
    const report = React.useCallback(
      (message) => bridge.emitField(rootTag, FieldEvent.Error, { elementType, message }),
      [rootTag, elementType]
    );
    const problem =
      problemOf(formId, protocolVersion) ??
      (ELEMENT_TYPES.includes(elementType) ? null : `Unknown field "${String(elementType)}".`) ??
      (parsed === null ? 'The field\'s settings could not be read.' : null);
    if (problem !== null) return React.createElement(Refused, { problem, report });
    return React.createElement(
      RootBoundary,
      { onCrash: report },
      React.createElement(ShownField, { key: `${formId}/${elementType}`, rootTag, formId, elementType, settings: parsed })
    );
  }

  return { FormRoot, FieldRoot };
}
