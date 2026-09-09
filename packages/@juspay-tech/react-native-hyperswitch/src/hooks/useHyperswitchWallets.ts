import { useEffect, useState } from 'react';
import { useHyperElementsContext } from '../context/HyperElements';
import { checkSessionWalletEligibility } from '../session/WalletEligibilityBridge';
import type { UseHyperswitchWalletsResult } from '../types/wallets';

/**
 * Reports the merchant/session-accurate wallet eligibility for this
 * checkout (real `allowed_payment_methods`, not just device capability —
 * see `useHyperswitchDeviceCapability` for that). Must be used inside a
 * `<HyperElements>` subtree — it waits for the session/elements to finish
 * loading before running the check.
 *
 * Backed by `checkSessionWalletEligibility`, which currently resolves
 * `{}` (no wallet eligible) until the embedded/prefetched session
 * instance is wired up — see `session/WalletEligibilityBridge.ts`.
 */
export function useHyperswitchWallets(): UseHyperswitchWalletsResult {
  const { loading: sessionLoading, sdkAuthorization } =
    useHyperElementsContext();

  const [state, setState] = useState<UseHyperswitchWalletsResult>({
    isLoading: true,
    wallets: {},
  });

  useEffect(() => {
    if (sessionLoading) {
      setState({ isLoading: true, wallets: {} });
      return;
    }

    let cancelled = false;

    (async () => {
      const wallets = sdkAuthorization
        ? await checkSessionWalletEligibility(sdkAuthorization)
        : {};

      if (!cancelled) {
        setState({ isLoading: false, wallets });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionLoading, sdkAuthorization]);

  return state;
}
