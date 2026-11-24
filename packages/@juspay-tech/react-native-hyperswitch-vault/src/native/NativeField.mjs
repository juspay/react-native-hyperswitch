/*
 * One card field on the native path, in the MERCHANT's engine: a native view, sized by what the
 * field inside it reports. Nothing typed ever reaches this component. It sends the field's data
 * props across as JSON text, and turns the field's events back into the callbacks a field has
 * always had.
 */
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { FieldEvent } from '../hosted/protocol.mjs';
import { VaultFieldView } from './fieldView.mjs';
import { fieldOut, read } from './out.mjs';

/* The native view fills the width its parent gives it, as the plain field's outer view does. */
const fill = { width: '100%' };

export const NativeField = React.forwardRef(function NativeField({ context, elementType, ...props }, ref) {
  const { forms, formId } = context;

  /* 0 until the field has drawn and reported how tall it is. */
  const [height, setHeight] = React.useState(0);

  const { settings, placement } = fieldOut(props, StyleSheet.flatten);

  const callbacks = React.useRef(props);
  callbacks.current = props;

  const onFieldEvent = React.useCallback((event) => {
    const { name, payload: text } = event.nativeEvent;
    const payload = read(text);
    switch (name) {
      case FieldEvent.Layout:
        if (typeof payload.height === 'number') setHeight(payload.height);
        break;
      case FieldEvent.Ready:
        callbacks.current.onReady?.(payload);
        break;
      case FieldEvent.Focus:
        callbacks.current.onFocus?.(payload);
        break;
      case FieldEvent.Blur:
        callbacks.current.onBlur?.(payload);
        break;
      case FieldEvent.Change:
        callbacks.current.onChange?.(payload);
        break;
      default:
        break;
    }
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        forms.sendCommand(formId, 'focus', elementType);
      },
      blur: () => {
        forms.sendCommand(formId, 'blur', elementType);
      },
      clear: () => {
        forms.sendCommand(formId, 'clear', elementType);
      },
    }),
    [forms, formId, elementType]
  );

  return React.createElement(VaultFieldView, {
    formId,
    elementType,
    settings,
    onFieldEvent,
    style: [fill, placement, { height }],
  });
});
