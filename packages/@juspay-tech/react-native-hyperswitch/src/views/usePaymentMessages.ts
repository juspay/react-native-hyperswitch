import { useCallback, useMemo, useRef } from 'react';
import type { MessageActionEvent } from '../codegen/modules/NativeHyperswitchModule';
import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import {
  dispatchMessageAction,
  preparePaymentMessages,
} from '../utils/PaymentMessages';

/* Native options are initial props, like every other widget option. The latest
   render's options are read at tap time, so recreated callbacks need no remount. */
export function usePaymentMessages(
  options: PaymentSheetConfiguration | undefined
) {
  const prepared = useMemo(() => preparePaymentMessages(options), [options]);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const dispatch = useCallback(
    (action: MessageActionEvent) =>
      dispatchMessageAction(optionsRef.current, action),
    []
  );
  return { configuration: prepared.configuration, dispatch };
}
