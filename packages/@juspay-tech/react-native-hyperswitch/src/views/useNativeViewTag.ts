import { useEffect, useState } from 'react';
import { findNodeHandle } from 'react-native';

const MAX_ATTEMPTS = 20;
const RETRY_INTERVAL_MS = 100;

/**
 * Polls `findNodeHandle` until the native view is attached and returns the
 * native view tag. Retries up to {@link MAX_ATTEMPTS} times spaced
 * {@link RETRY_INTERVAL_MS}ms apart to give Fabric time to attach the
 * shadow node on slower devices.
 */
export function useNativeViewTag(
  viewRef: React.RefObject<unknown>
): number | undefined {
  const [viewTag, setViewTag] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (viewTag !== undefined) return;

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = (attempt: number) => {
      if (!isMounted) return;
      if (viewRef.current == null) {
        if (attempt < MAX_ATTEMPTS) {
          timer = setTimeout(() => poll(attempt + 1), RETRY_INTERVAL_MS);
        }
        return;
      }
      const tag =
        findNodeHandle(
          viewRef.current as Parameters<typeof findNodeHandle>[0]
        ) ?? -1;
      if (tag !== -1) {
        setViewTag(tag);
      } else if (attempt < MAX_ATTEMPTS) {
        timer = setTimeout(() => poll(attempt + 1), RETRY_INTERVAL_MS);
      }
    };

    poll(0);

    return () => {
      isMounted = false;
      if (timer !== undefined) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTag]);

  return viewTag;
}
