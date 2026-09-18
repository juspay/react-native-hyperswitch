import { usePaymentMethodsSession } from './usePaymentMethodsSession';
import type { PaymentMethodsSession } from './SessionContext';

/**
 * The web SDK's name for the session hook. Returns this package's session
 * contract (`hyper`, `sdkAuthorization`, `vaultDetails`, `appearance`,
 * `locale`, `loading`, `error`), not the web's `{session, isPresent}` iframe
 * handle, which has no React Native counterpart.
 */
export function usePaymentMethodSession(): PaymentMethodsSession {
  return usePaymentMethodsSession();
}
