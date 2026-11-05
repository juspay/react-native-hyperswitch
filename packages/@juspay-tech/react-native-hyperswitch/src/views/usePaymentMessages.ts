import { useCallback, useMemo, useRef } from 'react';
import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import {
  dispatchMessageAction,
  preparePaymentMessages,
} from '../utils/PaymentMessages';

/* Native options are initial props, like every other widget option. The latest
   render's callbacks are read at tap time, so recreated callbacks need no remount. */
export function usePaymentMessages(
  options: PaymentSheetConfiguration | undefined
) {
  const prepared = useMemo(() => preparePaymentMessages(options), [options]);
  const callbacksRef = useRef(prepared.callbacks);
  callbacksRef.current = prepared.callbacks;
  const dispatch = useCallback(
    (index: number) => dispatchMessageAction(callbacksRef.current, index),
    []
  );
  return { configuration: prepared.configuration, dispatch };
}
