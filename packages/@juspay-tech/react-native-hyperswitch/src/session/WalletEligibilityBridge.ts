import type { WalletEligibilityMap } from '../types/wallets';

/**
 * Extension seam for `useHyperswitchWallets()` — the session/merchant-
 * accurate wallet eligibility check.
 *
 * Today there is no embedded/prefetched React instance to ask, so this
 * module is a swappable resolver with a safe default. The intended
 * production path, once the "PreFetch" embedded ReactView work lands in
 * `initPaymentSession`, is:
 *
 *   useHyperswitchWallets()
 *     -> checkSessionWalletEligibility(sdkAuthorization)        [this file]
 *     -> RN view event into the embedded/prefetched React instance
 *     -> embedded module reads the session's wallet config off the
 *        global JS variable PreFetch already populated during
 *        initPaymentSession (no extra network round trip)
 *     -> embedded module calls the existing device-check NativeModule
 *        (checkGooglePayReadiness / checkApplePayReadiness) with the
 *        merchant-accurate request JSON built from that session data
 *     -> result is bridged back and resolves the promise below
 *
 * None of that plumbing exists yet. Until it does,
 * `checkSessionWalletEligibility` resolves `{}` (no wallet marked
 * eligible) — never throws, never hangs. When the embedded module is
 * ready, wire it up with a single call to
 * `registerSessionWalletEligibilityResolver` (e.g. once, where the
 * embedded/prefetched instance is created) — no changes needed in
 * `useHyperswitchWallets` or anywhere else that consumes the hook.
 */

export type SessionWalletEligibilityResolver = (
  sdkAuthorization: string
) => Promise<WalletEligibilityMap>;

const UNAVAILABLE: WalletEligibilityMap = {};

/** Max time to wait on the (future) embedded-module round trip. */
const RESOLVER_TIMEOUT_MS = 3000;

let resolver: SessionWalletEligibilityResolver | null = null;
let warnedNoResolver = false;

function warnNoResolverRegistered(): void {
  if (warnedNoResolver) return;
  warnedNoResolver = true;
  console.warn(
    '[useHyperswitchWallets] no session wallet-eligibility resolver is ' +
      'registered yet (requires the embedded/prefetched session instance). ' +
      'All wallets will be reported as not eligible. Use ' +
      'useHyperswitchDeviceCapability() for a device-only check in the ' +
      'meantime, or call registerSessionWalletEligibilityResolver(...) ' +
      'once that instance exists.'
  );
}

/**
 * Plugs in (or removes, with `null`) the real session-based eligibility
 * check. Intended to be called exactly once by the future PreFetch /
 * embedded-module integration, not by merchant app code.
 */
export function registerSessionWalletEligibilityResolver(
  fn: SessionWalletEligibilityResolver | null
): void {
  resolver = fn;
}

/**
 * Resolves with `{}` immediately if no resolver is registered, or if the
 * registered resolver throws / doesn't respond within
 * {@link RESOLVER_TIMEOUT_MS} — the session-based check must never hang a
 * merchant's checkout on infrastructure that isn't wired up yet.
 */
export async function checkSessionWalletEligibility(
  sdkAuthorization: string
): Promise<WalletEligibilityMap> {
  if (!resolver) {
    warnNoResolverRegistered();
    return UNAVAILABLE;
  }

  try {
    return await Promise.race([
      resolver(sdkAuthorization),
      new Promise<WalletEligibilityMap>((resolve) => {
        setTimeout(() => resolve(UNAVAILABLE), RESOLVER_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return UNAVAILABLE;
  }
}
