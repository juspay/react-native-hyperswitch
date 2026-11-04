import { useCallback, useMemo, useRef, useState } from 'react';
import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import {
  dispatchMessageAction,
  randomKeySuffix,
  preparePaymentMessages,
} from '../utils/PaymentMessages';

/* Native options are initial props, like every other widget option. The latest
   render's callbacks are read at tap time, so recreated callbacks need no remount. */
export function usePaymentMessages(
  options: PaymentSheetConfiguration | undefined
) {
  /* Stable per view: native keeps the keys it mounted with. */
  const [keySuffix] = useState(randomKeySuffix);
  const prepared = useMemo(
    () => preparePaymentMessages(options, keySuffix),
    [options, keySuffix]
  );
  const callbacksRef = useRef(prepared.callbacks);
  callbacksRef.current = prepared.callbacks;
  const dispatch = useCallback(
    (event: { eventName: string; payload: unknown }) =>
      dispatchMessageAction(callbacksRef.current, event),
    []
  );
  return { configuration: prepared.configuration, dispatch };
}
